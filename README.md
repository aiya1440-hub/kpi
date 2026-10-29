# KPI 실습앱

## 파일 역할

- `index.html`: 페이지 구조와 `style.css`, `core.js`, `app.js` 상대 경로 참조
- `style.css`: 원본 화면의 스타일을 분리
- `app.js`: 필터 이벤트, 요약·막대·근거표 렌더링
- `core.js`: 가상 샘플, 월·부서·금액 검사, 합계와 달성률 계산
- `supabase.js`: Supabase Auth 비밀번호 로그인과 본인 행 PostgREST 조회·추가, 저장 응답/재조회 확인
- `data/kpi.json`, `data/kpi.csv`: 가져오기와 원본 비교용 사본. 현재 화면은 이 파일을 읽지 않고 `core.js`의 샘플을 사용
- `schema.sql`: 새 교육용 DB에 한 번만 적용하도록 만든 기본 스키마. 여기서는 실행하지 않은 설계 문서
- `schema-existing-db-additive.sql`: 기존 DB에 기존 테이블·데이터를 건드리지 않고 별도 `kpi_records_practice` 테이블을 추가하는 검토안. 기존 스키마에 대한 검증이나 실행은 하지 않음
- `config.example.js`: 공개 URL, anon key, 선택적 tableName 자리표시자. `config.js` 값 입력의 예시
- `config.js`: 로컬 설정 파일. 앱에서 공개 URL/key/tableName만 읽음. 토큰은 여기 저장하지 않으며 service_role 같은 비밀 키를 넣으면 안 됨
- `prd.md`: 화면에서 확인한 범위 및 다음 단계 제안
- `검증체크리스트.md`: 검증 결과와 실제 DB 연결 후 확인할 항목

## 실행

샘플은 `index.html`을 파일 탐색기에서 직접 열면 됩니다. CSS/JavaScript는 같은 폴더의 상대 경로이며 샘플 모드는 네트워크 요청이 없습니다.

Supabase DB 모드는 브라우저에서 `file://` fetch를 제한할 수 있어 HTTP 또는 HTTPS에서 실행하세요. 예: 실습앱 폴더에서 `python -m http.server 8000`을 실행하고 `http://localhost:8000`을 엽니다. 패키지나 외부 라이브러리는 사용하지 않습니다.

## 샘플과 DB의 차이

URL 또는 anon key 설정이 없으면 화면은 `core.js`의 가상 샘플 6행을 사용하고 ‘샘플 모드’·‘DB 미연결’을 표시합니다. 입력은 탭이 열린 동안의 메모리에서만 보이고 새로고침하면 사라집니다. JSON·CSV는 비교용 사본이고 자동으로 읽지 않습니다. 현재 `config.js`에는 값이 설정된 것으로 감지되지만, 이 작업에서는 로그인하거나 DB에 요청하지 않았으므로 연결 성공을 뜻하지 않습니다.

두 공개 설정을 `config.js`에 채우면 DB 모드를 사용할 수 있습니다. Supabase Auth에 이미 존재하는 사용자의 이메일/비밀번호 로그인을 지원합니다. 계정 생성 기능은 없습니다. 테이블을 지정하지 않으면 `kpi_records`를 사용합니다. 로그인 세션은 메모리에만 두며, DB 모드에서는 RLS 정책에 더해 본인 `user_id` 필터와 응답 소유권 검사를 적용합니다. 입력은 새 행 추가이며 중복 시 기존 데이터를 변경하지 않습니다. 저장 응답과 ID 기반 재조회, 목록 재조회가 확인된 후에만 성공 상태를 표시합니다.

`schema.sql`의 기본 SQL은 **새 교육용 DB에 한 번만** 적용하는 안내입니다. 여기서는 실행하지 않았습니다. 이미 DB가 있는 경우 먼저 기존 스키마를 확인하세요. `schema-existing-db-additive.sql`은 원본 테이블을 수정하지 않고 별도 `kpi_records_practice` 테이블을 만드는 검토안입니다. 기존 테이블이 실제로 있는지 확인할 수 없으므로 이 스크립트도 실행하지 않았습니다. 해당 테이블을 쓸 때는 `config.js`에 `tableName: 'kpi_records_practice'`를 지정해야 합니다.

## GitHub에 올릴 파일

공유할 파일: `.gitignore`, `index.html`, `style.css`, `app.js`, `core.js`, `supabase.js`, `data/kpi.json`, `data/kpi.csv`, `schema.sql`, `schema-existing-db-additive.sql`, `config.example.js`, `README.md`, `prd.md`, `검증체크리스트.md`. `config.js`는 `.gitignore`에 있어 올리지 않습니다. 브라우저에 공개되는 Supabase anon/publishable 키만 사용하고 RLS를 반드시 확인하세요. service_role 또는 다른 비밀 키를 HTML/JavaScript/저장소에 넣지 마세요.
