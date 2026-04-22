/**
 * Tahvel (TTK / tahveltp.edu.ee) timetable client.
 *
 * The upstream host (`tahveltp.edu.ee/hois_back`) doesn't send CORS headers,
 * so we go through a community-run Azure proxy. If the proxy ever disappears,
 * swap PROXY for our own Cloudflare Worker.
 */

const PROXY = 'https://tahvel-tunniplaan-proxy.azurewebsites.net/api/proxy'
const SCHOOL_ID = 14 // Tallinna Tehnikakõrgkool
const UPSTREAM = 'https://tahveltp.edu.ee/hois_back'

const prox = (url: string) => `${PROXY}?url=${encodeURIComponent(url)}`

export type TargetType = 'teacher' | 'group'

export type SearchResult = {
  uuid: string
  name: string
  type: TargetType
}

export type Lesson = {
  start: Date
  end: Date
  subject: string
  room: string
  teacher: string
  group: string
}

type RawTeacher = {
  teacherUuid?: string
  uuid?: string
  id?: number | string
  fullname?: string
  fullName?: string
  nameEt?: string
  name?: string
  firstName?: string
  firstname?: string
  lastName?: string
  lastname?: string
}

type RawGroup = {
  studentGroupUuid?: string
  uuid?: string
  id?: number | string
  nameEt?: string
  name?: string
  code?: string
}

type RawEvent = {
  date?: string
  startDate?: string
  start?: string
  dateStart?: string
  begin?: string
  endDate?: string
  end?: string
  dateEnd?: string
  finish?: string
  timeStart?: string
  timeEnd?: string
  nameEt?: string
  nameEn?: string
  name?: string
  subject?: string
  subjectName?: string
  course?: string
  title?: string
  rooms?: Array<{ roomCode?: string; room?: string; roomName?: string }>
  room?: string
  roomName?: string
  location?: string
  teachers?: Array<{
    name?: string
    fullName?: string
    fullname?: string
    firstname?: string
    firstName?: string
    lastname?: string
    lastName?: string
  }>
  teacher?: string
  studentGroups?: Array<{ code?: string; name?: string; uuid?: string }>
  lesson?: { name?: string }
}

type PageResp<T> =
  | T[]
  | {
      content?: T[]
      results?: T[]
      events?: T[]
    }

function coerceArray<T>(data: PageResp<T>): T[] {
  if (Array.isArray(data)) return data
  return data.content ?? data.results ?? data.events ?? []
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(prox(url), {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Tahvel: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function searchTeachers(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${UPSTREAM}/timetables/teacher/${SCHOOL_ID}?lang=ET&name=${encodeURIComponent(q)}`
  const raw = await getJson<PageResp<RawTeacher>>(url, signal)
  return coerceArray(raw)
    .map((row) => ({
      uuid: row.teacherUuid || row.uuid || String(row.id ?? ''),
      name:
        row.fullname ||
        row.fullName ||
        row.nameEt ||
        row.name ||
        [row.firstName || row.firstname, row.lastName || row.lastname]
          .filter(Boolean)
          .join(' ') ||
        'Teacher',
      type: 'teacher' as const,
    }))
    .filter((r) => r.uuid)
}

export async function searchGroups(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${UPSTREAM}/timetables/group/${SCHOOL_ID}?lang=ET&name=${encodeURIComponent(q)}`
  const raw = await getJson<PageResp<RawGroup>>(url, signal)
  return coerceArray(raw)
    .map((row) => ({
      uuid: row.studentGroupUuid || row.uuid || String(row.id ?? ''),
      name: row.nameEt || row.name || row.code || 'Group',
      type: 'group' as const,
    }))
    .filter((r) => r.uuid)
}

export async function search(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const [teachers, groups] = await Promise.all([
    searchTeachers(query, signal).catch(() => []),
    searchGroups(query, signal).catch(() => []),
  ])
  // Name queries with a space are probably teachers first.
  return query.includes(' ') ? [...teachers, ...groups] : [...groups, ...teachers]
}

function isoUtc(d: Date): string {
  return d.toISOString()
}

function parseDateTime(dateISO?: string, timeStr?: string): Date {
  if (!dateISO && !timeStr) return new Date(NaN)
  if (dateISO && timeStr) {
    const d = new Date(dateISO)
    const parts = String(timeStr).split(':').map((n) => Number.parseInt(n, 10) || 0)
    const h = parts[0] ?? 0
    const m = parts[1] ?? 0
    // Upstream already ships Europe/Tallinn times — construct in local (user
    // already runs Europe/Tallinn) to avoid UTC shift.
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0)
  }
  return new Date(dateISO || timeStr || NaN)
}

function normalizeEvent(ev: RawEvent): Lesson {
  const start = ev.date
    ? parseDateTime(ev.date, ev.timeStart)
    : new Date(ev.startDate || ev.start || ev.dateStart || ev.begin || '')
  const end = ev.date
    ? parseDateTime(ev.date, ev.timeEnd)
    : new Date(ev.endDate || ev.end || ev.dateEnd || ev.finish || '')
  const subject =
    ev.nameEt ||
    ev.nameEn ||
    ev.name ||
    ev.subject ||
    ev.course ||
    ev.title ||
    ev.subjectName ||
    ev.lesson?.name ||
    'Aine'
  const firstRoom = ev.rooms?.[0]
  const room =
    firstRoom?.roomCode ||
    firstRoom?.room ||
    firstRoom?.roomName ||
    ev.room ||
    ev.location ||
    ev.roomName ||
    ''
  const teacherName = ev.teachers?.map((t) =>
    t.name ||
    t.fullName ||
    t.fullname ||
    [t.firstname || t.firstName, t.lastname || t.lastName].filter(Boolean).join(' '),
  ).find(Boolean) || ev.teacher || ''
  const firstGroup = ev.studentGroups?.[0]
  const group = firstGroup?.code || firstGroup?.name || firstGroup?.uuid || ''
  return { start, end, subject, room, teacher: teacherName, group }
}

/** Monday 00:00 and Sunday 23:59:59.999 (local) for the week containing `d`. */
export function weekRange(d = new Date()): { from: Date; thru: Date } {
  const day = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
  const mon = new Date(d)
  mon.setDate(d.getDate() - day)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { from: mon, thru: sun }
}

export async function fetchTimetable(
  target: SearchResult,
  opts: { from: Date; thru: Date; signal?: AbortSignal },
): Promise<Lesson[]> {
  const key = target.type === 'teacher' ? 'teachers' : 'studentGroups'
  // API wants UTC ISO timestamps even though event times come back as local.
  const fromUtc = new Date(Date.UTC(
    opts.from.getFullYear(), opts.from.getMonth(), opts.from.getDate(),
    0, 0, 0, 0,
  ))
  const thruUtc = new Date(Date.UTC(
    opts.thru.getFullYear(), opts.thru.getMonth(), opts.thru.getDate(),
    23, 59, 59, 999,
  ))
  const url =
    `${UPSTREAM}/timetableevents/timetableSearch?` +
    `from=${encodeURIComponent(isoUtc(fromUtc))}` +
    `&lang=ET&page=0&schoolId=${SCHOOL_ID}&size=200` +
    `&${key}=${encodeURIComponent(target.uuid)}` +
    `&thru=${encodeURIComponent(isoUtc(thruUtc))}`
  const raw = await getJson<PageResp<RawEvent>>(url, opts.signal)
  return coerceArray(raw).map(normalizeEvent)
}
