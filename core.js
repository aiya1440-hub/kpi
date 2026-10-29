// 계산·값 검사·가상 데이터를 모아 둔 코어 모듈입니다.
// 파일 직접 열기(file://)에서도 fetch가 필요 없도록 데이터는 여기서 제공합니다.
(function (root) {
  'use strict';

  const sampleRecords = Object.freeze([
    Object.freeze({ month: '2026-09', department: '영업A', goal: 10000000, actual: 9000000 }),
    Object.freeze({ month: '2026-09', department: '영업B', goal: 8000000, actual: 8800000 }),
    Object.freeze({ month: '2026-09', department: '영업C', goal: 12000000, actual: 10800000 }),
    Object.freeze({ month: '2026-10', department: '영업A', goal: 10000000, actual: 11000000 }),
    Object.freeze({ month: '2026-10', department: '영업B', goal: 8000000, actual: 7200000 }),
    Object.freeze({ month: '2026-10', department: '영업C', goal: 12000000, actual: 12600000 }),
  ]);

  const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
  function calculateAchievement(actualTotal, goalTotal) {
    if (!Number.isSafeInteger(actualTotal) || actualTotal < 0) throw new TypeError('실적 합계는 0 이상의 안전한 정수여야 합니다.');
    if (!Number.isSafeInteger(goalTotal) || goalTotal < 0) throw new TypeError('목표 합계는 0 이상의 안전한 정수여야 합니다.');
    return goalTotal === 0 ? null : actualTotal / goalTotal * 100;
  }

  function validateRecord(record) {
    const errors = [];
    if (!record || typeof record !== 'object') return ['입력은 객체여야 합니다.'];
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month)) errors.push('월은 YYYY-MM 형식이어야 합니다.');
    if (typeof record.department !== 'string' || !record.department.trim()) errors.push('부서를 입력해야 합니다.');
    for (const field of ['goal', 'actual']) {
      if (!Number.isSafeInteger(record[field]) || record[field] < 0) errors.push(`${field}는 0 이상의 안전한 정수여야 합니다.`);
    }
    return errors;
  }

  function summarize(records) {
    if (!Array.isArray(records)) throw new TypeError('성과 행은 배열이어야 합니다.');
    const invalid = records.flatMap((record, index) => validateRecord(record).map(message => `행 ${index + 1}: ${message}`));
    if (invalid.length) throw new TypeError(invalid.join(' '));
    const goalTotal = records.reduce((sum, record) => sum + record.goal, 0);
    const actualTotal = records.reduce((sum, record) => sum + record.actual, 0);
    if (!Number.isSafeInteger(goalTotal) || !Number.isSafeInteger(actualTotal)) throw new RangeError('합계가 안전한 정수 범위를 벗어났습니다.');
    return { goalTotal, actualTotal, count: records.length, achievement: calculateAchievement(actualTotal, goalTotal) };
  }

  root.KpiCore = Object.freeze({ sampleRecords, numberFormat, calculateAchievement, validateRecord, summarize });
})(globalThis);
