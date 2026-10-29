-- 설계안 전용. 실행하지 마세요.
-- 새 Supabase 프로젝트의 새 테이블을 위한 제안이며 기존 테이블을 변경/삭제/재생성하지 않습니다.
-- 테이블 이름 kpi_records는 제안입니다. 대상 프로젝트의 기존 스키마를 확인한 뒤 적용 여부를 결정하세요.
-- kpi_month(월), department(부서), goal_amount(목표), actual_amount(실적)은 원본 화면에서 확인한 항목입니다.

create table public.kpi_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kpi_month date not null,
  department text not null,
  goal_amount bigint not null,
  actual_amount bigint not null,
  created_at timestamptz not null default now(),

  constraint kpi_records_month_first_day check (extract(day from kpi_month) = 1),
  constraint kpi_records_department_nonempty check (length(btrim(department)) > 0),
  constraint kpi_records_goal_nonnegative check (goal_amount >= 0),
  constraint kpi_records_actual_nonnegative check (actual_amount >= 0),
  constraint kpi_records_owner_month_department_unique unique (user_id, kpi_month, department)
);

alter table public.kpi_records enable row level security;
grant select, insert on public.kpi_records to authenticated;

create policy "Users can read their own KPI rows"
  on public.kpi_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own KPI rows"
  on public.kpi_records
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 원 단위 금액은 bigint 정수로 저장합니다. id, user_id, created_at,
-- 제약조건(같은 사용자·월·부서 중복 금지 포함), RLS는 DB 연동을 위한 추가 설계이며
-- 현재 원본 화면 데이터에는 없습니다. SQL은 실제 DB에 실행하지 않았습니다.
