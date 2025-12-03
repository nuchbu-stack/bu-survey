// ====== CONFIG API URL ======
const API_BASE = 'https://script.google.com/macros/s/AKfycbymSyC97Uocngmil7BZauHPyK1Ct4XFNRc64adpEHnyUSdIrXNhYbWYuM6nhuSKFhE9/exec'; // เช่น 'https://script.google.com/macros/s/XXXXX/exec'

let CONFIG = null;
let currentLang = 'th';

const state = {
  status: null,
  facultyId: null
};

// ---------- helper แปลข้อความ ----------
function tLabel(obj) {
  if (!obj) return '';
  if (currentLang === 'en' && obj.en) return obj.en;
  if (obj.th) return obj.th;
  return obj.en || '';
}

function tDisplay(obj) {
  if (!obj) return '';
  if (currentLang === 'en' && obj.en) return obj.en;
  if (obj.th) return obj.th;
  return obj.en || '';
}

// ---------- render question ----------
function createQuestionElement(q) {
  const wrap = document.createElement('div');
  wrap.className = 'question';
  wrap.dataset.qid = q.id;
  wrap.dataset.sectionId = q.sectionId;
  // เก็บ status ที่ต้องแสดง แยกด้วย , เช่น "STU,STAFF_BU"
  wrap.dataset.showForStatus = (q.showForStatus || []).join(',');

  const labelDiv = document.createElement('div');
  labelDiv.className = 'question-label';
  labelDiv.innerHTML = tLabel(q.label);
  if (q.required) {
    const req = document.createElement('span');
    req.className = 'required';
    req.textContent = '*';
    labelDiv.appendChild(req);
  }
  wrap.appendChild(labelDiv);

  if (q.help && (q.help.th || q.help.en)) {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'question-help';
    helpDiv.textContent = tLabel(q.help);
    wrap.appendChild(helpDiv);
  }

  let controlEl = null;

  // ---------- radio & scale ----------
  if (q.type === 'radio' || q.type === 'scale') {
    const group = document.createElement('div');
    group.className = 'option-group';

    // ถ้าเป็น scale แต่ไม่มี options → สร้าง 5–1 + N/A ให้เอง
    let opts = q.options || [];
    if (q.type === 'scale' && (!opts || opts.length === 0)) {
      const min = q.min || 1;
      const max = q.max || 5;
      const generated = [];

      for (let v = max; v >= min; v--) {
        generated.push({
          value: String(v),
          label: { th: String(v), en: String(v) }
        });
      }
      generated.push({
        value: 'NA',
        label: {
          th: 'ไม่ได้ใช้บริการ / ไม่เกี่ยวข้อง',
          en: 'Not applicable (N/A)'
        }
      });
      opts = generated;
    }

    (opts || []).forEach(opt => {
      const optDiv = document.createElement('label');
      optDiv.className = 'option-item';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = q.id;
      input.value = opt.value;
      if (q.required) input.required = true;

      // เช็คว่า option นี้คือ "อื่น ๆ" หรือไม่
      const labelText = tLabel(opt.label) || '';
      const isOtherOpt =
        (opt.value && opt.value.toLowerCase() === 'other') ||
        labelText === 'อื่น ๆ' ||
        labelText.toLowerCase() === 'other';

      // ถ้าเป็นคำถามสถานะ ให้ผูก event อัปเดต state.status + visibility
      if (q.id === 'status') {
        input.addEventListener('change', e => {
          state.status = e.target.value || null;

          // ถ้าไม่ได้เป็นนักศึกษาแล้ว ล้างค่า/ตัวเลือกคณะ + สาขา
          if (state.status !== 'STU') {
            state.facultyId = null;
            const facSel = document.querySelector('select[name="faculty_id"]');
            if (facSel) facSel.value = '';
            updateProgramOptions();
          }

          updateVisibilityByStatus();
        });
      }

      optDiv.appendChild(input);
      optDiv.appendChild(
        document.createTextNode(labelText || opt.value)
      );

      // ถ้าเป็นตัวเลือก "อื่น ๆ" → เพิ่ม textarea ให้กรอก
      if (isOtherOpt) {
        const ta = document.createElement('textarea');
        ta.name = q.id + '_other';
        ta.className = 'other-text';
        ta.placeholder =
          currentLang === 'en' ? 'Please specify' : 'โปรดระบุ';
        ta.style.display = 'none';

        // เวลาเลือก "อื่น ๆ" → โชว์ textarea, ถ้าเปลี่ยนไปเลือกอย่างอื่น → ซ่อน+เคลียร์
        input.addEventListener('change', () => {
          // สำหรับ radio: มีได้แค่ 1 อัน
          const allOthers = group.querySelectorAll('textarea.other-text');
          allOthers.forEach(o => {
            if (o !== ta) {
              o.style.display = 'none';
              o.value = '';
            }
          });

          if (input.checked) {
            ta.style.display = '';
          } else {
            ta.style.display = 'none';
            ta.value = '';
          }
        });

        optDiv.appendChild(ta);
      }

      group.appendChild(optDiv);
    });

    controlEl = group;

  // ---------- checkbox ----------
  } else if (q.type === 'checkbox') {
    const group = document.createElement('div');
    group.className = 'option-group';

    (q.options || []).forEach(opt => {
      const optDiv = document.createElement('label');
      optDiv.className = 'option-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = q.id;
      input.value = opt.value;

      const labelText = tLabel(opt.label) || '';
      const isOtherOpt =
        (opt.value && opt.value.toLowerCase() === 'other') ||
        labelText === 'อื่น ๆ' ||
        labelText.toLowerCase() === 'other';

      optDiv.appendChild(input);
      optDiv.appendChild(
        document.createTextNode(labelText || opt.value)
      );

      if (isOtherOpt) {
        const ta = document.createElement('textarea');
        ta.name = q.id + '_other';
        ta.className = 'other-text';
        ta.placeholder =
          currentLang === 'en' ? 'Please specify' : 'โปรดระบุ';
        ta.style.display = 'none';

        input.addEventListener('change', () => {
          if (input.checked) {
            ta.style.display = '';
          } else {
            ta.style.display = 'none';
            ta.value = '';
          }
        });

        optDiv.appendChild(ta);
      }

      group.appendChild(optDiv);
    });

    controlEl = group;

  // ---------- select ----------
  } else if (q.type === 'select') {
    const select = document.createElement('select');
    select.name = q.id;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent =
      currentLang === 'en' ? '-- Please select --' : '-- โปรดเลือก --';
    select.appendChild(placeholder);

    if (q.id === 'faculty_id') {
      // คณะ
      (CONFIG.lookups.faculties || []).forEach(f => {
        const op = document.createElement('option');
        op.value = f.id;
        op.textContent = tLabel(f.name) || f.id;
        select.appendChild(op);
      });
      select.addEventListener('change', e => {
        state.facultyId = e.target.value || null;
        updateProgramOptions();
      });

    } else if (q.id === 'program_id') {
      // หลักสูตร – จะเติมภายหลังตอนเลือกคณะ
      select.dataset.programSelect = '1';

    } else if (q.id === 'unit_id') {
      // หน่วยงานบุคลากร
      (CONFIG.lookups.units || []).forEach(u => {
        const op = document.createElement('option');
        op.value = u.id;
        op.textContent = tLabel(u.name) || u.id;
        select.appendChild(op);
      });

    } else {
      // select ทั่วไป
      (q.options || []).forEach(opt => {
        const op = document.createElement('option');
        op.value = opt.value;
        op.textContent = tLabel(opt.label) || opt.value;
        select.appendChild(op);
      });
    }

    controlEl = select;

  // ---------- text ----------
  } else if (q.type === 'text') {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = q.id;
    if (q.required) input.required = true;
    controlEl = input;

  // ---------- textarea ----------
  } else if (q.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.name = q.id;
    if (q.required) ta.required = true;
    controlEl = ta;
  }

  if (controlEl) {
    wrap.appendChild(controlEl);
  } else {
    const note = document.createElement('div');
    note.className = 'muted';
    note.textContent = 'Question type not supported in this UI version.';
    wrap.appendChild(note);
  }

  return wrap;
}



// ---------- render form ----------
function renderForm() {
  const container = document.getElementById('sectionsContainer');
  container.innerHTML = '';

  // รีเซ็ต state ทุกครั้งที่วาดใหม่
  state.status = null;
  state.facultyId = null;

  CONFIG.sections.forEach(sec => {
    const secDiv = document.createElement('div');
    secDiv.className = 'section';
    secDiv.dataset.sectionId = sec.id;

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = tLabel(sec.title);
    secDiv.appendChild(title);

    if (sec.description && (sec.description.th || sec.description.en)) {
      const desc = document.createElement('div');
      desc.className = 'section-desc';
      desc.textContent = tLabel(sec.description);
      secDiv.appendChild(desc);
    }

    sec.questions.forEach(q => {
      const qEl = createQuestionElement(q);
      secDiv.appendChild(qEl);
    });

    container.appendChild(secDiv);
  });

  // ถ้ามี status ถูกเลือกอยู่ (กรณีอนาคตตั้ง default) ให้ sync เข้า state
  const checkedStatus = document.querySelector('input[name="status"]:checked');
  if (checkedStatus) {
    state.status = checkedStatus.value || null;
  }

  updateProgramOptions();
  updateVisibilityByStatus();
}


// ---------- visibility ตาม status ----------
function updateVisibilityByStatus() {
  const status = state.status;
  const allQuestions = document.querySelectorAll('.question');

  allQuestions.forEach(qEl => {
    const showFor = (qEl.dataset.showForStatus || '').trim();
    if (!showFor) {
      qEl.style.display = '';
      return;
    }
    const allowed = showFor
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!status) {
      qEl.style.display = 'none';
    } else if (allowed.includes(status)) {
      qEl.style.display = '';
    } else {
      qEl.style.display = 'none';
    }
  });
}

// ---------- เติมหลักสูตรตามคณะ ----------
function updateProgramOptions() {
  const select = document.querySelector('select[name="program_id"]');
  if (!select) return;

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent =
    currentLang === 'en'
      ? '-- Select faculty/program --'
      : '-- โปรดเลือกคณะ/สาขา --';
  select.appendChild(placeholder);

  const fid = state.facultyId;
  if (!fid) return;

  const list = (CONFIG.lookups.programsByFaculty || {})[fid] || [];
  list.forEach(p => {
    const op = document.createElement('option');
    op.value = p.id;
    op.textContent = tDisplay(p.display) || p.id;
    select.appendChild(op);
  });
}

// ---------- สลับภาษา ----------
function setupLangToggle() {
  const buttons = document.querySelectorAll('.lang-toggle button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (!lang || lang === currentLang) return;
      currentLang = lang;

      buttons.forEach(b => b.classList.toggle('active', b === btn));

      const titleEl = document.getElementById('appTitle');
      const subtitleEl = document.getElementById('appSubtitle');
      if (currentLang === 'en') {
        titleEl.textContent = 'Bangkok University – Learning Support Survey';
        subtitleEl.textContent =
          'A general survey about learning support, study spaces, and related services.';
      } else {
        titleEl.textContent = 'แบบประเมินสิ่งสนับสนุนการเรียนรู้ มหาวิทยาลัยกรุงเทพ';
        subtitleEl.textContent =
          'แบบประเมินภาพรวมเกี่ยวกับสิ่งสนับสนุนการเรียนรู้ พื้นที่การใช้งาน และบริการต่าง ๆ';
      }

      renderForm();
    });
  });
}

// ---------- เก็บคำตอบทั้งหมด ----------
function collectAnswers() {
  const formEl = document.getElementById('surveyForm');
  const result = {};

  result.ui_lang = currentLang;

  const elements = formEl.querySelectorAll(
    'input[name], select[name], textarea[name]'
  );
  const checkboxGroups = {};

  elements.forEach(el => {
    const name = el.name;
    if (!name) return;

    if (el.type === 'checkbox') {
      if (!checkboxGroups[name]) checkboxGroups[name] = [];
      if (el.checked) checkboxGroups[name].push(el.value);
    } else if (el.type === 'radio') {
      if (el.checked) result[name] = el.value;
    } else if (el.tagName === 'SELECT') {
      result[name] = el.value;
    } else {
      result[name] = el.value;
    }
  });

  Object.keys(checkboxGroups).forEach(name => {
    result[name] = checkboxGroups[name];
  });

  return result;
}

// ---------- submit ----------
async function submitForm(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const statusText = document.getElementById('statusText');

  statusText.textContent = '';
  statusText.className = 'status-msg';

  const data = collectAnswers();

  btn.disabled = true;
  btn.textContent = currentLang === 'en' ? 'Submitting...' : 'กำลังส่ง...';

  try {
    // ส่งแบบ application/x-www-form-urlencoded เพื่อหลบ preflight
    const body = 'payload=' + encodeURIComponent(JSON.stringify(data));

    const res = await fetch(API_BASE + '?act=submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });

    let json;
    try {
      json = await res.json();
    } catch (err) {
      const text = await res.text();
      console.error('Raw response (not JSON):', text);
      throw new Error('Server did not return JSON');
    }

    console.log('Submit response:', json);

    if (!json.ok) {
      throw new Error(json.error || 'Unknown error from server');
    }

    statusText.textContent =
      currentLang === 'en'
        ? 'Thank you for your response.'
        : 'ขอบคุณที่ร่วมตอบแบบประเมินค่ะ';
    statusText.classList.add('status-ok');

    document.getElementById('surveyForm').reset();
    state.status = null;
    state.facultyId = null;
    updateProgramOptions();
    updateVisibilityByStatus();

  } catch (err) {
    console.error('Submit error:', err);
    const msgTh =
      'เกิดข้อผิดพลาดในการส่งแบบประเมิน: ' + (err.message || '');
    const msgEn = 'Error while submitting: ' + (err.message || '');
    statusText.textContent = currentLang === 'en' ? msgEn : msgTh;
    statusText.classList.add('status-error');
  } finally {
    btn.disabled = false;
    btn.textContent =
      currentLang === 'en'
        ? 'Submit'
        : 'ส่งแบบประเมิน / Submit';
  }
}



// ---------- โหลด CONFIG จาก Apps Script ----------
async function loadConfig() {
  const statusText = document.getElementById('statusText');
  statusText.textContent = 'กำลังโหลดแบบประเมิน...';

  try {
    const res = await fetch(API_BASE + '?act=config');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Cannot load config');

    CONFIG = json.config;
    statusText.textContent = '';

    setupLangToggle();
    renderForm();
  } catch (err) {
    console.error(err);
    statusText.textContent =
      'โหลดแบบประเมินไม่สำเร็จ กรุณาลองโหลดหน้าใหม่อีกครั้ง';
    statusText.classList.add('status-error');
  }
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('surveyForm')
    .addEventListener('submit', submitForm);

  loadConfig();
});
