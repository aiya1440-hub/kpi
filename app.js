// UI and event handling. Data calculations live in core.js; network/session code in supabase.js.
(function () {
  'use strict';
  const core = window.KpiCore;
  const db = window.KpiSupabase;
  const settings = db.getSettings();
  const numberFormat = core.numberFormat;
  const state = {
    mode: settings.configured ? 'database' : 'sample',
    records: settings.configured ? [] : core.sampleRecords.map(row => ({ ...row })),
    busy: false,
  };
  const $ = selector => document.querySelector(selector);
  const monthFilter = $('#month-filter');
  const departmentFilter = $('#department-filter');
  const loginForm = $('#login-form');
  const logoutButton = $('#logout-button');
  const recordForm = $('#record-form');
  const saveButton = $('#save-button');
  const connectionMessage = $('#connection-message');
  const evidenceBody = $('#evidence-body');
  const bars = $('#department-bars');
  const modeBadge = $('#mode-badge');
  const connectionBadge = $('#connection-badge');
  const formatPercent = value => value === null ? '목표 미설정' : `${numberFormat.format(value)}%`;
  const formatWon = value => `${numberFormat.format(value)}원`;
  const monthName = month => `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

  function setMessage(message, kind = 'info') {
    connectionMessage.textContent = message;
    connectionMessage.className = `connection-message ${kind}`;
  }

  function setBusy(value) {
    state.busy = value;
    for (const element of loginForm.elements) element.disabled = value;
    for (const element of recordForm.elements) element.disabled = value || (state.mode === 'database' && !db.isSignedIn());
    logoutButton.disabled = value;
  }

  function updateModeUI() {
    const database = state.mode === 'database';
    modeBadge.innerHTML = `<i></i>${database ? 'DB 모드' : '샘플 모드'}`;
    connectionBadge.textContent = database ? (db.isSignedIn() ? 'DB 로그인됨' : '로그인 필요') : 'DB 미연결';
    loginForm.hidden = !database || db.isSignedIn();
    logoutButton.hidden = !database || !db.isSignedIn();
    saveButton.textContent = database ? 'DB에 저장' : '샘플에 추가 (저장 안 함)';
    $('#entry-help').textContent = database
      ? (db.isSignedIn() ? '본인 계정에 저장합니다. 저장 응답과 재조회가 일치해야 완료로 표시됩니다.' : 'DB 저장은 로그인 후 사용할 수 있습니다.')
      : '샘플 모드 입력은 이 페이지의 메모리에만 있으며 자동 저장되지 않습니다.';
    setBusy(state.busy);
  }

  function populateFilters(keepValues = true) {
    const previousMonth = keepValues ? monthFilter.value : 'all';
    const previousDepartment = keepValues ? departmentFilter.value : 'all';
    monthFilter.replaceChildren();
    departmentFilter.replaceChildren();
    const months = [...new Set(state.records.map(row => row.month))].sort().reverse();
    const departments = [...new Set(state.records.map(row => row.department))].sort((a, b) => a.localeCompare(b, 'ko'));
    addOption(monthFilter, 'all', '전체 월');
    months.forEach(month => addOption(monthFilter, month, monthName(month)));
    addOption(departmentFilter, 'all', '전체 부서');
    departments.forEach(department => addOption(departmentFilter, department, department));
    monthFilter.value = months.includes(previousMonth) || previousMonth === 'all' ? previousMonth : 'all';
    departmentFilter.value = departments.includes(previousDepartment) || previousDepartment === 'all' ? previousDepartment : 'all';
  }

  function addOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value; option.textContent = label; select.append(option);
  }

  function render() {
    const filtered = state.records.filter(row =>
      (monthFilter.value === 'all' || row.month === monthFilter.value) &&
      (departmentFilter.value === 'all' || row.department === departmentFilter.value));
    const summary = core.summarize(filtered);
    $('#goal-total').textContent = formatWon(summary.goalTotal);
    $('#actual-total').textContent = formatWon(summary.actualTotal);
    $('#achievement-rate').textContent = formatPercent(summary.achievement);
    $('#record-count').textContent = `${summary.count}건`;
    $('#result-count').textContent = `${summary.count}건 조회`;
    const period = monthFilter.value === 'all' ? '전체 기간' : monthName(monthFilter.value);
    $('#bar-period').textContent = period;
    $('#table-period').textContent = period;

    if (!filtered.length) {
      evidenceBody.innerHTML = '<tr><td class="empty" colspan="5"><strong>조건에 맞는 결과가 없습니다</strong>다른 월이나 부서를 선택해 주세요.</td></tr>';
      bars.innerHTML = '<div class="no-bars">표시할 부서 실적이 없습니다.</div>';
      return;
    }
    evidenceBody.innerHTML = filtered.map(row => {
      const rate = core.calculateAchievement(row.actual, row.goal);
      return `<tr><td><span class="department">${escapeHtml(row.department)}</span></td><td>${monthName(row.month)}</td><td class="num">${numberFormat.format(row.goal)}</td><td class="num actual">${numberFormat.format(row.actual)}</td><td class="num rate">${formatPercent(rate)}</td></tr>`;
    }).join('');
    const byDepartment = [...new Set(filtered.map(row => row.department))].map(department => {
      const totals = core.summarize(filtered.filter(row => row.department === department));
      return { department, rate: totals.achievement };
    });
    bars.innerHTML = byDepartment.map(({ department, rate }) => {
      const width = rate === null ? 0 : Math.min(rate, 100);
      const safeDepartment = escapeHtml(department);
      return `<div class="bar-row"><span class="bar-name">${safeDepartment}</span><div class="bar-track" role="img" aria-label="${safeDepartment} 달성률 ${formatPercent(rate)}"><div class="bar-fill" style="width:${width}%"></div></div><span class="bar-rate">${formatPercent(rate)}</span></div>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  async function loadDatabaseRows() {
    const rows = await db.listOwnRows();
    state.records = rows.map(({ id, ...row }) => ({ ...row, dbId: id }));
    populateFilters(false);
    render();
    return rows.length;
  }

  monthFilter.addEventListener('change', render);
  departmentFilter.addEventListener('change', render);
  $('#reset-filters').addEventListener('click', () => { monthFilter.value = 'all'; departmentFilter.value = 'all'; render(); });

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;
    setBusy(true);
    setMessage('로그인 중입니다…');
    try {
      await db.signIn(email, password);
      loginForm.reset();
      const count = await loadDatabaseRows();
      updateModeUI();
      setMessage(`로그인했습니다. 본인 KPI ${count}건을 조회했습니다.`, 'success');
    } catch (error) {
      await db.signOut();
      loginForm.elements.password.value = '';
      state.records = [];
      populateFilters(false);
      render();
      updateModeUI();
      setMessage(error.message || '로그인 또는 본인 데이터 조회에 실패했습니다.', 'error');
    } finally { setBusy(false); }
  });

  logoutButton.addEventListener('click', async () => {
    setBusy(true);
    await db.signOut();
    state.records = [];
    populateFilters(false);
    render();
    updateModeUI();
    setMessage('로그아웃했습니다. DB 행은 화면에서 지웠습니다.', 'info');
    setBusy(false);
  });

  recordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!recordForm.reportValidity()) return;
    const values = new FormData(recordForm);
    const record = {
      month: String(values.get('month')),
      department: String(values.get('department')).trim(),
      goal: Number(values.get('goal')),
      actual: Number(values.get('actual')),
    };
    const errors = core.validateRecord(record);
    if (errors.length) { setMessage(errors.join(' '), 'error'); return; }
    setBusy(true);
    let databaseSaveVerified = false;
    try {
      if (state.mode === 'sample') {
        state.records.push(Object.freeze({ ...record }));
        setMessage('샘플 화면에 추가했습니다. DB에는 저장하지 않았습니다.', 'success');
      } else {
        if (!db.isSignedIn()) throw new Error('DB 저장은 먼저 로그인해 주세요.');
        await db.saveOwnRow(record);
        databaseSaveVerified = true;
        await loadDatabaseRows();
        setMessage('저장 응답을 받았고, 본인 행 재조회 값도 확인했습니다.', 'success');
      }
      recordForm.reset();
      populateFilters(false);
      monthFilter.value = record.month;
      departmentFilter.value = record.department;
      render();
    } catch (error) {
      if (databaseSaveVerified) {
        recordForm.reset();
        setMessage('저장 응답과 본인 행 재조회는 확인했습니다. 다만 전체 목록 갱신에 실패했으니 다시 불러와 확인하세요.', 'error');
      } else {
        setMessage(error.message || '요청 결과를 확인하지 못했습니다. 재시도 전에 DB 상태를 조회하세요.', 'error');
      }
    } finally { setBusy(false); }
  });

  if (settings.configured) {
    updateModeUI();
    setMessage('DB 설정이 있습니다. 로그인하면 RLS가 적용된 본인 행만 조회합니다. 세션은 페이지 메모리에만 유지됩니다.');
  } else {
    updateModeUI();
    setMessage('Supabase URL 또는 anon key가 없어 샘플을 표시합니다. DB 미연결 상태이며 샘플은 자동 저장하지 않습니다.');
  }
  populateFilters(false);
  render();
})();
