// Supabase Auth/PostgREST adapter. No SDK, token persistence, or logging.
(function (root) {
  'use strict';
  let accessToken = null;
  let userId = null;

  function getSettings() {
    const config = root.KPI_PUBLIC_CONFIG || {};
    const rawUrl = typeof config.supabaseUrl === 'string' ? config.supabaseUrl.trim() : '';
    const anonKey = typeof config.supabaseAnonKey === 'string' ? config.supabaseAnonKey.trim() : '';
    const tableName = typeof config.tableName === 'string' && config.tableName.trim() ? config.tableName.trim() : 'kpi_records';
    let url = '';
    try {
      const parsed = new URL(rawUrl);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if ((parsed.protocol === 'https:' || (isLocal && parsed.protocol === 'http:')) && !parsed.username && !parsed.password) url = parsed.origin;
    } catch { /* invalid or empty placeholder */ }
    const validTable = /^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName);
    return Object.freeze({ configured: Boolean(url && anonKey && validTable), url, anonKey, tableName: validTable ? tableName : 'kpi_records' });
  }

  function parseBody(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  }

  async function request(path, options = {}, token = accessToken) {
    const settings = getSettings();
    if (!settings.configured) throw new Error('Supabase 연결 정보가 설정되지 않았습니다.');
    let response;
    try {
      response = await fetch(`${settings.url}${path}`, {
        ...options,
        headers: {
          apikey: settings.anonKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error('Supabase에 연결할 수 없습니다. URL, 인터넷 연결, CORS 설정을 확인하세요.');
    }
    const body = parseBody(await response.text());
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) throw new Error('로그인 정보가 맞지 않거나 세션이 만료되었습니다.');
      if (response.status === 403) throw new Error('접근이 거부되었습니다. 테이블 권한과 RLS 정책을 확인하세요.');
      if (response.status === 404 || response.status === 406) throw new Error('테이블 또는 API 경로를 찾지 못했습니다. 설정한 테이블 이름과 스키마를 확인하세요.');
      if (response.status === 409) throw new Error('같은 월·부서 행이 이미 있습니다. 기존 행은 덮어쓰지 않았습니다.');
      throw new Error(`Supabase 요청이 실패했습니다 (HTTP ${response.status}). 테이블과 정책을 확인하세요.`);
    }
    return body;
  }

  async function signIn(email, password) {
    const result = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, null);
    if (!result || typeof result.access_token !== 'string' || !result.user || typeof result.user.id !== 'string') {
      throw new Error('로그인 응답을 확인할 수 없습니다. Supabase Auth 설정을 확인하세요.');
    }
    // Keep the session in memory only; never write or display tokens.
    accessToken = result.access_token;
    userId = result.user.id;
    return Object.freeze({ id: userId });
  }

  async function signOut() {
    const token = accessToken;
    accessToken = null;
    userId = null;
    if (!token) return;
    try { await request('/auth/v1/logout', { method: 'POST' }, token); } catch { /* local session is already cleared */ }
  }

  function requireSession() {
    if (!accessToken || !userId) throw new Error('먼저 로그인해 주세요.');
    return { id: userId };
  }

  function toAppRecord(row) {
    if (!row || row.user_id !== userId) throw new Error('본인 소유가 아닌 행이 응답에 포함되어 요청을 중단했습니다.');
    if (typeof row.id !== 'string' || !row.id || typeof row.kpi_month !== 'string' || !/^\d{4}-\d{2}-01$/.test(row.kpi_month)) {
      throw new Error('DB 행 식별자 또는 월 형식이 올바르지 않습니다.');
    }
    const parseAmount = value => {
      if (!(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) &&
          !(typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)))) {
        throw new Error('DB 금액이 0 이상의 안전한 정수가 아닙니다.');
      }
      return Number(value);
    };
    const month = row.kpi_month.slice(0, 7);
    const record = { id: row.id, month, department: row.department, goal: parseAmount(row.goal_amount), actual: parseAmount(row.actual_amount) };
    const errors = root.KpiCore.validateRecord(record);
    if (errors.length) throw new Error('DB 행 형식이 앱에서 허용하는 범위를 벗어났습니다. 관리자에게 스키마를 확인해 주세요.');
    return Object.freeze(record);
  }

  function rowsPath(extra = '') {
    const { tableName } = getSettings();
    return `/rest/v1/${encodeURIComponent(tableName)}?select=id,user_id,kpi_month,department,goal_amount,actual_amount,created_at${extra}`;
  }

  async function listOwnRows() {
    const user = requireSession();
    const rows = await request(rowsPath(`&user_id=eq.${encodeURIComponent(user.id)}&order=kpi_month.asc,department.asc`));
    if (!Array.isArray(rows)) throw new Error('DB 조회 응답 형식이 올바르지 않습니다.');
    return rows.map(toAppRecord);
  }

  async function saveOwnRow(record) {
    const user = requireSession();
    const errors = root.KpiCore.validateRecord(record);
    if (errors.length) throw new Error(errors.join(' '));
    const body = {
      user_id: user.id,
      kpi_month: `${record.month}-01`,
      department: record.department.trim(),
      goal_amount: record.goal,
      actual_amount: record.actual,
    };
    const inserted = await request(rowsPath(), {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!Array.isArray(inserted) || inserted.length !== 1) throw new Error('저장 응답에서 생성된 행을 확인하지 못했습니다.');
    const saved = toAppRecord(inserted[0]);
    if (saved.month !== record.month || saved.department !== record.department.trim() || saved.goal !== record.goal || saved.actual !== record.actual) {
      throw new Error('저장 응답 값이 요청 값과 달라 재조회 검증을 중단했습니다.');
    }
    const verificationPath = rowsPath(`&id=eq.${encodeURIComponent(saved.id)}&user_id=eq.${encodeURIComponent(user.id)}`);
    const reread = await request(verificationPath);
    if (!Array.isArray(reread) || reread.length !== 1) throw new Error('저장 후 본인 행 재조회에 실패했습니다.');
    const verified = toAppRecord(reread[0]);
    if (verified.id !== saved.id || verified.month !== saved.month || verified.department !== saved.department || verified.goal !== saved.goal || verified.actual !== saved.actual) {
      throw new Error('재조회한 행이 저장 응답과 일치하지 않습니다.');
    }
    return verified;
  }

  root.KpiSupabase = Object.freeze({ getSettings, signIn, signOut, listOwnRows, saveOwnRow, isSignedIn: () => Boolean(accessToken && userId) });
})(window);
