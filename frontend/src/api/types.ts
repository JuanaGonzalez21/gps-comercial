// API contract types. They mirror docs/api-contract.md exactly (snake_case, as sent by the backend).
// Dates are ISO-8601 UTC strings; format them for America/Bogota only at display time (src/lib/format.ts).

export type IsoDateTime = string

export type Permission =
  | 'dashboard:read'
  | 'vehicles:read'
  | 'drivers:read'
  | 'passengers:read'
  | 'history:read'
  | 'drivers:write'
  | 'passengers:write'
  | 'assignments:write'
  | 'vehicles:custom_fields:write'
  | 'exports:csv'
  | 'users:manage'
  | 'audit:read'

export type RoleCode = 'admin' | 'operator' | 'viewer'

export interface RoleRef {
  code: RoleCode
  name: string
}

export interface Me {
  id: string
  email: string
  full_name: string
  role: RoleRef
  permissions: Permission[]
  must_change_password: boolean
}

export interface AuthResponse {
  user: Me
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface PageParams {
  page?: number
  page_size?: number
  sort?: string
}

export interface FieldErrorItem {
  field: string
  message: string
}

/** RFC 7807 Problem Details as returned by the backend. */
export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string | null
  code: string
  instance?: string | null
  request_id?: string | null
  errors?: FieldErrorItem[] | null
}

// ---------- Users, roles and audit ----------

export interface UserOut {
  id: string
  email: string
  full_name: string
  role: RoleRef
  is_active: boolean
  must_change_password: boolean
  last_login_at: IsoDateTime | null
  created_at: IsoDateTime
}

export interface UserCreateInput {
  email: string
  full_name: string
  role: RoleCode
}

export interface UserCreatedResponse {
  user: UserOut
  temporary_password: string
}

export interface UserUpdateInput {
  full_name?: string
  role?: RoleCode
  is_active?: boolean
}

export interface PasswordResetResponse {
  temporary_password: string
}

export interface RoleOut {
  code: RoleCode
  name: string
  permissions: Permission[]
}

export interface UserListParams extends PageParams {
  search?: string
  role?: RoleCode
  is_active?: boolean
}

export type AuditOutcome = 'success' | 'failure'

export interface AuditLogOut {
  id: number
  occurred_at: IsoDateTime
  actor_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  outcome: AuditOutcome
  ip_address: string | null
  details: Record<string, unknown> | null
}

export interface AuditListParams extends PageParams {
  action?: string
  actor?: string
  outcome?: AuditOutcome
  date_from?: IsoDateTime
  date_to?: IsoDateTime
}

// ---------- Fleet ----------

export type VehicleStatus = 'moving' | 'stopped' | 'no_signal'

export interface Position {
  latitude: number
  longitude: number
  speed_kmh: number | null
  course_deg: number | null
  altitude_m: number | null
  satellites: number | null
  recorded_at: IsoDateTime
}

export interface DriverRef {
  resource_id: number
  id: number
  name: string
  phone: string | null
}

export interface PassengerRef {
  resource_id: number
  id: number
  name: string
  phone: string | null
}

export interface VehicleRef {
  id: number
  name: string
}

export interface CustomField {
  id: number
  name: string
  value: string
}

export interface VehicleSummary {
  id: number
  name: string
  status: VehicleStatus
  last_message_at: IsoDateTime | null
  position: Position | null
  driver: DriverRef | null
  passenger_count: number
}

export interface VehicleDetail extends VehicleSummary {
  custom_fields: CustomField[]
  passengers: PassengerRef[]
}

export interface VehicleMarker {
  id: number
  name: string
  status: VehicleStatus
  latitude: number
  longitude: number
  speed_kmh: number | null
  course_deg: number | null
  last_message_at: IsoDateTime | null
  driver_name: string | null
}

export interface VehiclePositions {
  items: VehicleMarker[]
  generated_at: IsoDateTime
}

export interface VehicleListParams extends PageParams {
  search?: string
  status?: VehicleStatus
  has_driver?: boolean
}

export interface CustomFieldInput {
  name: string
  value: string
}

export interface CustomFieldUpdateInput extends CustomFieldInput {
  expected_value?: string
}

export interface TrackPoint {
  recorded_at: IsoDateTime
  latitude: number
  longitude: number
  speed_kmh: number | null
  course_deg: number | null
}

export interface TrackStats {
  total_points: number
  returned_points: number
  simplified: boolean
  truncated: boolean
  distance_km: number
  max_speed_kmh: number | null
  avg_speed_kmh: number | null
  duration_s: number
}

export interface Track {
  vehicle_id: number
  from: IsoDateTime
  to: IsoDateTime
  points: TrackPoint[]
  stats: TrackStats
}

export interface TrackParams {
  from: IsoDateTime
  to: IsoDateTime
  max_points?: number
}

export interface ResourceOut {
  id: number
  name: string
}

export interface DriverOut {
  resource_id: number
  id: number
  name: string
  code: string | null
  phone: string | null
  description: string | null
  vehicle: VehicleRef | null
}

export interface DriverInput {
  resource_id?: number
  name: string
  code?: string | null
  phone?: string | null
  description?: string | null
}

export interface DriverListParams extends PageParams {
  search?: string
  assigned?: boolean
}

export interface PassengerCustomField {
  key: string
  value: string
}

export interface PassengerOut {
  resource_id: number
  id: number
  name: string
  code: string | null
  phone: string | null
  vehicle: VehicleRef | null
  custom_fields: PassengerCustomField[]
}

export interface PassengerInput {
  resource_id?: number
  name: string
  code?: string | null
  phone?: string | null
  custom_fields?: PassengerCustomField[]
}

export interface PassengerCustomFieldUpdateInput {
  value: string
  new_key?: string
}

export interface PassengerListParams extends PageParams {
  search?: string
  assigned?: boolean
  vehicle_id?: number
}

export interface AssignmentInput {
  unit_id: number
}

export interface DashboardSummary {
  vehicles_total: number
  vehicles_by_status: Record<VehicleStatus, number>
  vehicles_with_driver: number
  vehicles_without_driver: number
  drivers_total: number
  passengers_total: number
  generated_at: IsoDateTime
}

export interface SystemInfo {
  fleet_source: 'wialon' | 'fake'
  environment: 'development' | 'test' | 'production'
}

export type ExportEntity = 'vehicles' | 'drivers' | 'passengers'
