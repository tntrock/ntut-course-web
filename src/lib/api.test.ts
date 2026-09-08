import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeFetch, installFakeCaches, removeCaches } from '@/test/fake-cache'
import type { Meta } from '@/types/api'

let restoreCaches: () => void

beforeEach(() => {
  restoreCaches = installFakeCaches()
})

afterEach(() => {
  restoreCaches()
  vi.unstubAllGlobals()
})

describe('fetchVersioned', () => {
  /**
   * 學校把罕用字存成私用區碼位（見 `lib/pua.ts`）。在資料進來的這一層就換掉，
   * 而不是在每個顯示姓名的元件各做一次 —— 全站有十幾個地方會印教師姓名,
   * 漏掉任何一個就是一個空方塊。
   */
  it('把學校的造字換成〇', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/teachers.json': { teachers: [{ id: '23533', name: '林' }] },
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchVersioned<{ teachers: { name: string }[] }>(
      '115-1/teachers.json',
      'v1',
    )

    expect(data.teachers[0]?.name).toBe('林〇')
  })

  it('快取命中時也要換 —— 不然重新整理之後又變回空方塊', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/teachers.json': { teachers: [{ id: '23533', name: '林' }] },
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/teachers.json', 'v1')
    const again = await fetchVersioned<{ teachers: { name: string }[] }>(
      '115-1/teachers.json',
      'v1',
    )

    expect(fetchMock.calls).toHaveLength(1)
    expect(again.teachers[0]?.name).toBe('林〇')
  })

  it('把版本號附加在網址上並回傳解析後的 JSON', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchVersioned<{ course_count: number }>(
      '115-1/index.json',
      '2026-09-05T03:34:59Z',
    )

    expect(data.course_count).toBe(2717)
    expect(fetchMock.calls).toHaveLength(1)
    expect(fetchMock.calls[0]).toContain('v=2026-09-05T03%3A34%3A59Z')
  })

  it('版本相同時第二次呼叫不發網路請求', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    const second = await fetchVersioned<{ course_count: number }>(
      '115-1/index.json',
      'v1',
    )

    expect(second.course_count).toBe(2717)
    expect(fetchMock.calls).toHaveLength(1)
  })

  it('版本改變時重新下載並拿到新資料', async () => {
    const { fetchVersioned } = await import('./api')
    const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    await fetchVersioned('115-1/index.json', 'v2')

    expect(fetchMock.calls).toHaveLength(2)
  })

  it('版本改變後清掉同一路徑的舊版本,快取不會無限成長', async () => {
    const { fetchVersioned, API_CACHE_NAME } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/index.json': { course_count: 2717 },
      '114-2/index.json': { course_count: 2809 },
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchVersioned('115-1/index.json', 'v1')
    await fetchVersioned('114-2/index.json', 'v1')
    await fetchVersioned('115-1/index.json', 'v2')

    const cache = await caches.open(API_CACHE_NAME)
    const urls = (await cache.keys()).map((r) => r.url).sort()

    // 115-1 只留 v2,114-2 的 v1 不受影響
    expect(urls).toHaveLength(2)
    expect(urls.some((u) => u.includes('115-1/index.json?v=v2'))).toBe(true)
    expect(urls.some((u) => u.includes('115-1/index.json?v=v1'))).toBe(false)
    expect(urls.some((u) => u.includes('114-2/index.json?v=v1'))).toBe(true)
  })

  it('回應非 2xx 時丟出帶狀態碼與路徑的 ApiError', async () => {
    const { fetchVersioned, ApiError } = await import('./api')
    vi.stubGlobal(
      'fetch',
      createFakeFetch({ '115-1/syllabus/1.json': { status: 404 } }),
    )

    const err = await fetchVersioned('115-1/syllabus/1.json', 'v1').catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(ApiError)
    expect((err as InstanceType<typeof ApiError>).status).toBe(404)
    expect((err as InstanceType<typeof ApiError>).path).toBe('115-1/syllabus/1.json')
  })

  it('Cache Storage 不可用時(無痕視窗)仍能正常取得資料', async () => {
    const restore = removeCaches()
    try {
      const { fetchVersioned } = await import('./api')
      const fetchMock = createFakeFetch({ '115-1/index.json': { course_count: 2717 } })
      vi.stubGlobal('fetch', fetchMock)

      const data = await fetchVersioned<{ course_count: number }>(
        '115-1/index.json',
        'v1',
      )

      expect(data.course_count).toBe(2717)
      expect(fetchMock.calls).toHaveLength(1)
    } finally {
      restore()
    }
  })
})

describe('fetchMeta', () => {
  const META = { schema_version: 2, latest: '115-1', semesters: [] }

  it('不帶版號,每次都重新取得(meta 本身就是版本的來源)', async () => {
    const { fetchMeta } = await import('./api')
    const fetchMock = createFakeFetch({ 'meta.json': META })
    vi.stubGlobal('fetch', fetchMock)

    await fetchMeta()
    const second = await fetchMeta()

    expect(second.data.latest).toBe('115-1')
    expect(second.fromCache).toBe(false)
    expect(fetchMock.calls).toHaveLength(2)
    expect(fetchMock.calls[0]).not.toContain('?v=')
  })

  it('離線時退回上次快取的 meta,並標示資料非最新', async () => {
    const { fetchMeta } = await import('./api')
    vi.stubGlobal('fetch', createFakeFetch({ 'meta.json': META }))
    await fetchMeta()

    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const offline = await fetchMeta()

    expect(offline.data.latest).toBe('115-1')
    expect(offline.fromCache).toBe(true)
  })

  it('離線且沒有快取時丟出錯誤,不會回傳空資料', async () => {
    const { fetchMeta } = await import('./api')
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    await expect(fetchMeta()).rejects.toThrow()
  })
})

describe('semesterVersion', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [
      { path: '115-1', generated_at: '2026-09-05T03:34:59Z' },
      { path: '110-1', generated_at: '2026-09-04T01:19:26Z' },
    ],
  } as unknown as import('@/types/api').Meta

  it('用該學期自己的 generated_at,不是 meta 的', async () => {
    const { semesterVersion } = await import('./api')

    // 舊學期的版本永遠不變 —— 這是「歷史資料只下載一次」的根據
    expect(semesterVersion(meta, '110-1')).toBe('2026-09-04T01:19:26Z')
  })

  it('學期不存在時丟出錯誤,不會默默用錯版本', async () => {
    const { semesterVersion } = await import('./api')

    expect(() => semesterVersion(meta, '99-9')).toThrow(/99-9/)
  })
})

describe('fetchSemesterIndex', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '110-1', generated_at: '2026-09-04T01:19:26Z' }],
  } as unknown as import('@/types/api').Meta

  it('抓舊學期時帶的是該學期的版本號', async () => {
    const { fetchSemesterIndex } = await import('./api')
    const fetchMock = createFakeFetch({ '110-1/index.json': { course_count: 2428 } })
    vi.stubGlobal('fetch', fetchMock)

    const index = await fetchSemesterIndex(meta, '110-1')

    expect(index.course_count).toBe(2428)
    expect(fetchMock.calls[0]).toContain('110-1/index.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-04T01%3A19%3A26Z')
  })
})

describe('對未知欄位的容忍度', () => {
  // crawler 承諾新增欄位不升 schema_version,所以多出來的欄位必須被原樣帶過。
  // 這條測試是護欄:哪天有人加上 runtime schema 驗證(zod 之類),它會先壞掉。
  it('回應含型別沒宣告的欄位時照樣可用,不丟棄也不報錯', async () => {
    const { fetchVersioned } = await import('./api')
    vi.stubGlobal(
      'fetch',
      createFakeFetch({
        '115-1/index.json': {
          schema_version: 2,
          course_count: 1,
          courses: [{ id: '1', name_zh: '測試', brand_new_field: 'v3 才有的欄位' }],
          another_new_top_level_field: 42,
        },
      }),
    )

    const index = await fetchVersioned<{
      course_count: number
      courses: { id: string }[]
    }>('115-1/index.json', 'v1')

    expect(index.course_count).toBe(1)
    expect(index.courses[0]?.id).toBe('1')
    expect(Reflect.get(index, 'another_new_top_level_field')).toBe(42)
  })
})

describe('fetchDepartments', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: '2026-09-05T03:34:59Z' }],
  } as unknown as import('@/types/api').Meta

  it('帶該學期的版本號抓學院/系所對照', async () => {
    const { fetchDepartments } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/departments.json': {
        departments: [{ id: '59', name: '資工系' }],
        colleges: [{ name: '電資學院', department_ids: ['59'] }],
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchDepartments(meta, '115-1')

    expect(data.departments[0]?.id).toBe('59')
    expect(fetchMock.calls[0]).toContain('115-1/departments.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-05T03%3A34%3A59Z')
  })
})

describe('fetchSyllabusProgress', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: '2026-09-05T03:34:59Z' }],
  } as unknown as import('@/types/api').Meta

  it('用 meta.generated_at 當版本號 —— 大綱進度是全站範圍,不屬於任何學期', async () => {
    const { fetchSyllabusProgress } = await import('./api')
    const fetchMock = createFakeFetch({
      'syllabus.json': {
        schema_version: 2,
        semesters: [{ semester: '115-1', fetched: 1909 }],
        fetched: { '115-1': { '364893': '2026-09-05T06:21:43Z' } },
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchSyllabusProgress(meta)

    expect(data.semesters[0]?.fetched).toBe(1909)
    expect(fetchMock.calls[0]).toContain('syllabus.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-05T03%3A34%3A59Z')
  })
})

describe('fetchSyllabus', () => {
  it('版本號用該門課自己的抓取時間,不是學期的 generated_at', async () => {
    // 老師改大綱時學期索引不會跟著重新產生。用學期版本號會讓修訂過的大綱
    // 一直取到舊的那份。
    const { fetchSyllabus } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/syllabus/364893.json': { course_id: '364893', has_content: true },
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchSyllabus('115-1', '364893', '2026-09-05T06:21:43Z')

    expect(data.course_id).toBe('364893')
    expect(fetchMock.calls[0]).toContain('115-1/syllabus/364893.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-05T06%3A21%3A43Z')
  })
})

describe('fetchCourse', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: '2026-09-05T03:34:59Z' }],
  } as unknown as import('@/types/api').Meta

  const entry = (departmentIds: string[]) =>
    ({
      id: '364893',
      name_zh: '數位影像處理',
      department_ids: departmentIds,
    }) as unknown as import('@/types/api').CourseIndexEntry

  it('從索引裡的系所代碼取出完整課程物件', async () => {
    const { fetchCourse } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/courses/59.json': {
        courses: [{ id: '364893', name_zh: '數位影像處理', syllabus_url: 'https://x' }],
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    const course = await fetchCourse(meta, '115-1', entry(['59']))

    expect(course.syllabus_url).toBe('https://x')
    expect(fetchMock.calls).toHaveLength(1)
    expect(fetchMock.calls[0]).toContain('115-1/courses/59.json')
  })

  it('第一個系所檔沒有這門課時,換下一個系所代碼再找', async () => {
    // 合開課掛在多個系所底下(實測 111 門)。實測三個系所檔的內容一致,
    // 但一致是資料的巧合,不是 API 的承諾 —— 找不到就換一個比較誠實。
    const { fetchCourse } = await import('./api')
    const fetchMock = createFakeFetch({
      '115-1/courses/30.json': { courses: [] },
      '115-1/courses/B2.json': { courses: [{ id: '364893', name_zh: '數位影像處理' }] },
    })
    vi.stubGlobal('fetch', fetchMock)

    const course = await fetchCourse(meta, '115-1', entry(['30', 'B2']))

    expect(course.id).toBe('364893')
    expect(fetchMock.calls).toHaveLength(2)
  })

  it('所有系所檔都沒有時丟出 CourseNotFoundError', async () => {
    const { fetchCourse, CourseNotFoundError } = await import('./api')
    vi.stubGlobal(
      'fetch',
      createFakeFetch({ '115-1/courses/59.json': { courses: [] } }),
    )

    const err = await fetchCourse(meta, '115-1', entry(['59'])).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(CourseNotFoundError)
  })

  it('索引裡沒有系所代碼時直接丟錯,不發出任何請求', async () => {
    const { fetchCourse, CourseNotFoundError } = await import('./api')
    const fetchMock = createFakeFetch({})
    vi.stubGlobal('fetch', fetchMock)

    const err = await fetchCourse(meta, '115-1', entry([])).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(CourseNotFoundError)
    expect(fetchMock.calls).toHaveLength(0)
  })
})

describe('瀏覽層的端點', () => {
  const meta = {
    schema_version: 2,
    generated_at: '2026-09-05T03:34:59Z',
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: '2026-09-05T03:34:59Z' }],
  } as unknown as import('@/types/api').Meta

  const cases = [
    ['fetchTeachers', '115-1/teachers.json', undefined],
    ['fetchClasses', '115-1/classes.json', undefined],
    ['fetchPrograms', '115-1/programs.json', undefined],
    ['fetchClassrooms', '115-1/classrooms.json', undefined],
    ['fetchTeacherCourses', '115-1/teachers/11453.json', '11453'],
    ['fetchClassCourses', '115-1/classes/1212.json', '1212'],
  ] as const

  for (const [name, path, id] of cases) {
    it(`${name} 帶該學期的版本號打 ${path}`, async () => {
      const api = (await import('./api')) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >
      const fetchMock = createFakeFetch({ [path]: { schema_version: 2 } })
      vi.stubGlobal('fetch', fetchMock)

      const fn = api[name]
      expect(fn).toBeTypeOf('function')
      await (id === undefined ? fn?.(meta, '115-1') : fn?.(meta, '115-1', id))

      expect(fetchMock.calls[0]).toContain(path)
      // 舊學期的版本號永遠不變,歷史資料才只下載一次
      expect(fetchMock.calls[0]).toContain('v=2026-09-05T03%3A34%3A59Z')
    })
  }

  it('教師代碼含特殊字元時會被編碼進路徑,不會生出壞網址', async () => {
    const { fetchTeacherCourses } = await import('./api')
    const fetchMock = createFakeFetch({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchTeacherCourses(meta, '115-1', 'a b/c').catch(() => undefined)

    expect(fetchMock.calls[0]).toContain('teachers/a%20b%2Fc.json')
  })
})

describe('fetchChanges', () => {
  const meta = {
    schema_version: 3,
    generated_at: '2026-09-06T03:35:46Z',
    latest: '115-1',
    semesters: [{ path: '115-1', generated_at: '2026-09-05T08:17:49Z' }],
  } as unknown as import('@/types/api').Meta

  it('用 meta.generated_at 當版本號 —— 異動事件跨學期,不屬於任何一個', async () => {
    const { fetchChanges } = await import('./api')
    const fetchMock = createFakeFetch({
      'changes.json': { schema_version: 3, event_count: 15, events: [] },
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchChanges(meta)

    expect(data.event_count).toBe(15)
    expect(fetchMock.calls[0]).toContain('changes.json')
    expect(fetchMock.calls[0]).toContain('v=2026-09-06T03%3A35%3A46Z')
  })
})

describe('fetchTeacherCoursesInRange', () => {
  /**
   * 老師不一定每個學期都開課 —— 實測侯政伯在退選率頁的六個學期窗口裡
   * 只有 114-1 查得到,其餘五個都是 404。少一個學期不能讓整頁失敗。
   */
  const meta = {
    semesters: [
      { path: '115-1', generated_at: 'a' },
      { path: '114-2', generated_at: 'b' },
      { path: '114-1', generated_at: 'c' },
    ],
  } as unknown as Meta

  const teacherFile = (name: string) => ({
    teacher: { id: '24622', name },
    courses: [{ id: '1', name_zh: '工程力學' }],
  })

  it('跳過查不到的學期,不要整批失敗', async () => {
    const { fetchTeacherCoursesInRange } = await import('./api')
    vi.stubGlobal(
      'fetch',
      createFakeFetch({ '114-1/teachers/24622.json': teacherFile('侯政伯') }),
    )

    const got = await fetchTeacherCoursesInRange(
      meta,
      ['115-1', '114-2', '114-1'],
      '24622',
    )

    expect(got.map((g: { semester: string }) => g.semester)).toEqual(['114-1'])
  })

  it('保持由新到舊的順序', async () => {
    const { fetchTeacherCoursesInRange } = await import('./api')
    vi.stubGlobal(
      'fetch',
      createFakeFetch({
        '115-1/teachers/24622.json': teacherFile('侯政伯'),
        '114-1/teachers/24622.json': teacherFile('侯政伯'),
      }),
    )

    const got = await fetchTeacherCoursesInRange(
      meta,
      ['115-1', '114-2', '114-1'],
      '24622',
    )

    expect(got.map((g: { semester: string }) => g.semester)).toEqual(['115-1', '114-1'])
  })

  it('全部都查不到就回傳空陣列,由呼叫端決定要不要當成查無此人', async () => {
    const { fetchTeacherCoursesInRange } = await import('./api')
    vi.stubGlobal('fetch', createFakeFetch({}))

    expect(await fetchTeacherCoursesInRange(meta, ['115-1', '114-1'], '24622')).toEqual(
      [],
    )
  })
})
