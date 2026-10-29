-- 기존 DB 검토용 선택안. 실행 전 대상 DB와 이름을 직접 확인하세요.
-- 기존 테이블, 데이터, 정책을 수정하거나 삭제하지 않습니다.
-- 이 스크립트는 별도의 새 테이블만 생성합니다. 해당 이름이 이미 있으면 실패하며 덮어쓰지 않습니다.
-- 실행한다면 한 번만 실행하고, config.js의 tableName을 kpi_records_practice로 맞춥니다.

create table public.kpi_records_practice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kpi_month date not null,
  department text not null,
  goal_amount bigint not null,
  actual_amount bigint not null,
  created_at timestamptz not null default now(),

  constraint kpi_records_practice_month_first_day check (extract(day from kpi_month) = 1),
  constraint kpi_records_practice_department_nonempty check (length(btrim(department)) > 0),
  constraint kpi_records_practice_goal_nonnegative check (goal_amount >= 0),
  constraint kpi_records_practice_actual_nonnegative check (actual_amount >= 0),
  constraint kpi_records_practice_owner_month_department_unique unique (user_id, kpi_month, department)
);

alter table public.kpi_records_practice enable row level security;
grant select, insert on public.kpi_records_practice to authenticated;

create policy "Users can read own KPI practice rows"
  on public.kpi_records_practice
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own KPI practice rows"
  on public.kpi_records_practice
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 이 분리 테이블은 기존 업무 테이블에서 데이터를 복사하지 않습니다.
-- 실제 실행은 별도 승인과 스키마 검토 뒤에만 하세요. 이 저장소에서는 실행하지 않았습니다.
