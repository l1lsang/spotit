import { ArrowLeft, Check, Flag, LayoutDashboard, LockKeyhole, LogOut, MapPin, MessageCircle, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/admin.css'
import { getAdminStats, listAdminCases, loginAdmin, logoutAdmin, manageAdminUser, reviewCase, searchAdminUsers, type AdminStats } from '../services/moderationService'
import { CASE_LABELS, REPORT_REASONS, STATUS_LABELS, type AdminUser, type CaseStatus, type ModerationCase } from '../types/moderation'

const storageKey = 'spotit.admin.session.v1'
type AdminSession = { token: string; expiresAt: number }
function storedSession(): AdminSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as AdminSession | null
    return value && typeof value.token === 'string' && value.expiresAt > Date.now() ? value : null
  } catch { return null }
}
function errorText(error: unknown) { return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' }
function date(value: number) { return value ? new Date(value).toLocaleString('ko-KR') : '기록 없음' }
function reasonLabel(value: string) { return REPORT_REASONS.find(reason => reason.id === value)?.label || (value === 'auto' ? '자동 필터 감지' : '문의') }

export function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(storedSession)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  useEffect(() => {
    if (!session) return
    let cancelled = false
    void getAdminStats(session.token).then(() => { if (!cancelled) setVerified(true) }).catch(e => {
      if (!cancelled) { setSession(null); sessionStorage.removeItem(storageKey); setError(errorText(e)) }
    })
    const timer = window.setTimeout(() => {
      setVerified(false); setSession(null); sessionStorage.removeItem(storageKey); setError('관리자 세션이 만료되었습니다. 다시 로그인해 주세요.')
    }, Math.max(0, session.expiresAt - Date.now()))
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [session])
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const next = await loginAdmin(password)
      sessionStorage.setItem(storageKey, JSON.stringify(next)); setPassword(''); setVerified(true); setSession(next)
    } catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }
  async function logout() {
    if (!session) return
    await logoutAdmin(session.token)
    sessionStorage.removeItem(storageKey); setVerified(false); setSession(null)
  }
  if (session && verified) return <AdminDashboard token={session.token} onLogout={logout} />
  return (
    <main className="admin-login-page">
      <Link className="admin-back" to="/map"><ArrowLeft size={16} aria-hidden="true" />스팟잇으로 돌아가기</Link>
      <section className="admin-login-card" aria-labelledby="admin-login-heading">
        <img src="/logo.png" alt="스팟잇" width="64" height="64" />
        <p className="eyebrow">SPOTIT ADMIN</p>
        <h1 id="admin-login-heading">스팟잇 관리실</h1>
        <p>더 안전하고 즐거운 장소 기록을 위해.</p>
        {session ? <p role="status">관리자 권한을 확인하는 중…</p> : (
          <form className="form" onSubmit={login} aria-busy={busy}>
            <label className="field icon-field">
              <span>관리자 비밀번호</span>
              <LockKeyhole size={18} aria-hidden="true" />
              <input autoFocus type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={200} disabled={busy} placeholder="비밀번호를 입력하세요" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary" type="submit" disabled={busy || !password.trim()}>{busy ? '확인 중…' : '관리자 접속'}</button>
          </form>
        )}
        <small><ShieldCheck size={14} aria-hidden="true" />관리자 전용 공간</small>
      </section>
    </main>
  )
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => Promise<void> }) {
  const [tab, setTab] = useState<'overview' | 'cases' | 'users'>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    setBusy(true); setError('')
    try { setStats(await getAdminStats(token)) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }, [token])
  useEffect(() => { void refresh() }, [refresh])
  const metrics = stats ? [
    { label: '총 사용자', value: stats.users, detail: `최근 7일 가입 ${stats.newUsers}명`, icon: Users },
    { label: '게시 중인 핀', value: stats.posts, detail: `최근 7일 등록 ${stats.newPosts}개`, icon: MapPin },
    { label: '전체 채팅방', value: stats.chats, detail: '1:1 · 단체 채팅방', icon: MessageCircle },
    { label: '미처리 접수', value: stats.openCases, detail: '신고 · 문의 · 자동 검토', icon: Flag },
  ] : []
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><img src="/logo.png" width="38" height="38" alt="스팟잇" /><div><strong>스팟잇</strong><small>관리자 페이지</small></div></Link><nav aria-label="관리 메뉴">
    <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><LayoutDashboard size={18} />통계</button>
    <button className={tab === 'cases' ? 'active' : ''} onClick={() => setTab('cases')}><Flag size={18} />신고·문의{stats ? <span>{stats.openCases}</span> : null}</button>
    <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users size={18} />유저 관리</button>
  </nav><div className="admin-sidebar-footer"><Link to="/map"><ArrowLeft size={16} />서비스로 이동</Link><button onClick={() => { setBusy(true); void onLogout().catch(e => { setError(errorText(e)); setBusy(false) }) }} disabled={busy}><LogOut size={16} />로그아웃</button></div></aside>
  <main className="admin-main"><header className="admin-heading"><div><p className="eyebrow">SPOTIT ADMIN</p><h1>{tab === 'overview' ? '한눈에 보는 스팟잇' : tab === 'cases' ? '신고·문의 관리' : '유저 관리'}</h1><p>{tab === 'overview' ? '서비스 현황과 지금 확인할 일을 살펴보세요.' : tab === 'cases' ? '접수된 내용을 확인하고 처리 결과를 남겨 주세요.' : '유저를 검색하고 계정 이용 상태를 관리하세요.'}</p></div>
    <div className="admin-heading-actions">
      <div className="admin-total-users" role="status" aria-busy={busy}>
        <Users size={18} aria-hidden="true" /><span>총 사용자</span><strong>{stats ? stats.users.toLocaleString('ko-KR') : '—'}</strong><span>명</span>
      </div>
      <button className="button button-secondary" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} />통계 새로고침</button>
    </div>
  </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {tab === 'overview' && <>
      <div className="admin-metrics">{metrics.length ? metrics.map(metric => <article key={metric.label}><div><span>{metric.label}</span><metric.icon size={20} /></div><strong>{metric.value.toLocaleString()}</strong><small>{metric.detail}</small></article>) : <p role="status">통계를 불러오는 중…</p>}</div>
      <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-row"><h2>확인이 필요한 항목</h2><span className="case-badge open">운영 현황</span></div><button className="admin-overview-link" onClick={() => setTab('cases')}><div><strong>신고·문의 검토</strong><p>접수 및 검토 중인 항목을 처리해 주세요.</p></div><b>{stats?.openCases ?? '—'}건 →</b></button><button className="admin-overview-link" onClick={() => setTab('users')}><div><strong>유저 이용 상태</strong><p>현재 이용 정지된 계정</p></div><b>{stats?.suspendedUsers ?? '—'}명 →</b></button></section>
      <section className="admin-panel"><h2>핀 검토 기준</h2><ul className="admin-guidelines"><li>불법 거래·촬영물 의심 문구와 링크 도배는 자동 검토 목록으로 들어옵니다.</li><li>신고 증거를 확인한 뒤 핀을 숨기거나 다시 복구할 수 있습니다.</li><li>신고 횟수만으로 핀을 삭제하지 않습니다.</li><li>사진 자동 판별은 아직 연결되지 않았습니다. 첨부 사진을 직접 확인해 주세요.</li></ul></section></div>
      <p className="admin-footnote">최근 7일은 현재 시각 기준입니다. 핀 통계는 현재 게시된 핀만 집계하며, 숨겨진 핀은 제외됩니다.</p>
    </>}
    {tab === 'cases' && <CasesPanel token={token} onChanged={refresh} />}
    {tab === 'users' && <UsersPanel token={token} onChanged={refresh} />}
  </main></div>
}

function CasesPanel({ token, onChanged }: { token: string; onChanged: () => Promise<void> }) {
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<ModerationCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setCases([]); setCursor(null)
    void listAdminCases(token, kind, status).then(result => { if (!cancelled) { setCases(result.cases); setCursor(result.nextCursor) } }).catch(e => { if (!cancelled) setError(errorText(e)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, kind, status, version])
  async function more() {
    if (!cursor) return
    setLoading(true); setError('')
    try { const result = await listAdminCases(token, kind, status, cursor); setCases(previous => [...previous, ...result.cases]); setCursor(result.nextCursor) }
    catch (e) { setError(errorText(e)) } finally { setLoading(false) }
  }
  return <><section className="admin-panel"><div className="admin-filters"><label>접수 유형<select value={kind} onChange={e => setKind(e.target.value)} disabled={loading}><option value="all">전체 유형</option>{Object.entries(CASE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>처리 상태<select value={status} onChange={e => setStatus(e.target.value)} disabled={loading}><option value="all">전체 상태</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><button className="button button-secondary" disabled={loading} onClick={() => setVersion(v => v + 1)}><RefreshCw size={16} />내역 새로고침</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="admin-case-list">{cases.map(item => <button key={item.id} className="admin-case-row" onClick={() => setSelected(item)}><span className={`admin-type-icon ${item.kind}`}><Flag size={18} /></span><div><small>{CASE_LABELS[item.kind]} · {reasonLabel(item.reason)}</small><strong>{item.title}</strong><p>{item.details || '상세 내용 없음'}</p><small>{item.reporterName} · {date(item.createdAt)}</small></div><span className={`case-badge ${item.status}`}>{STATUS_LABELS[item.status]}</span></button>)}</div>
    {loading && <p className="empty-text" role="status">접수 내역을 불러오는 중…</p>}{!loading && !cases.length && !error && <div className="admin-empty"><Check size={30} /><h3>접수 내역이 없습니다</h3><p>선택한 조건에 해당하는 신고나 문의가 없어요.</p></div>}{cursor && <button className="button button-secondary" disabled={loading} onClick={() => void more()}>더 보기</button>}
  </section>{selected && <CaseDetail key={selected.id} item={selected} token={token} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setVersion(v => v + 1); void onChanged() }} />}</>
}

function CaseDetail({ item, token, onClose, onSaved }: { item: ModerationCase; token: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(item.status)
  const [note, setNote] = useState(item.note || '')
  const [reply, setReply] = useState(item.reply || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const evidence = item.kind !== 'inquiry' ? item.evidence : undefined
  async function save(action: 'save' | 'hide' | 'restore') {
    setBusy(true); setError('')
    try { await reviewCase(token, item.id, action === 'hide' ? 'resolved' : status, note, reply, action); onSaved() }
    catch (e) { setError(errorText(e)); setBusy(false) }
  }
  return <AdminDialog title="접수 상세" busy={busy} onClose={onClose}><div className="admin-row"><span className="eyebrow">{CASE_LABELS[item.kind]}</span><span className={`case-badge ${item.status}`}>{STATUS_LABELS[item.status]}</span></div><h3>{item.title}</h3><p>{reasonLabel(item.reason)} · {date(item.createdAt)}</p><p className="preserve-text">{item.details || '추가 설명 없음'}</p><small>신고자: {item.reporterName} · {item.reporterUid}</small>
    {evidence && <section className="admin-evidence"><h3>접수 당시 콘텐츠</h3>{evidence.authorNickname && <p>작성자: {evidence.authorNickname}</p>}{evidence.nickname && <p>{evidence.nickname} @{evidence.username}</p>}{evidence.placeName && <p>{evidence.placeName} · {evidence.address}</p>}<p className="preserve-text">{evidence.content || evidence.bio}</p><div className="admin-evidence-photos">{evidence.photoUrls?.map(url => <a href={safeImage(url)} key={url} target="_blank" rel="noreferrer"><img src={safeImage(url)} alt="신고된 콘텐츠 사진" loading="lazy" /></a>)}</div>{evidence.messages?.map(message => <article className="admin-evidence-message" key={message.id}><strong>{message.authorNickname}</strong><p className="preserve-text">{message.content}</p>{message.photoUrl && <img src={safeImage(message.photoUrl)} alt="신고된 채팅 사진" loading="lazy" />}</article>)}</section>}
    {item.targetUid && <p className="admin-footnote">대상 UID: {item.targetUid}</p>}
    <form className="form" onSubmit={e => { e.preventDefault(); void save('save') }}><label>처리 상태<select value={status} onChange={e => setStatus(e.target.value as CaseStatus)} disabled={busy}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>관리자 메모 (내부용)<textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={2000} disabled={busy} /></label>{item.kind !== 'auto' && <label>사용자에게 보낼 답변<textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} maxLength={2000} disabled={busy} placeholder="사용자의 문의·신고 내역에 표시됩니다." /></label>}{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-actions"><button className="button button-primary" disabled={busy}>{busy ? '처리 중…' : '처리 결과 저장'}</button>{['pin', 'auto'].includes(item.kind) && <><button type="button" className="button button-danger" disabled={busy} onClick={() => void save('hide')}>핀 숨김·처리 완료</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => void save('restore')}>숨긴 핀 복구</button></>}</div></form>
  </AdminDialog>
}

function safeImage(url: string) { return /^https?:\/\//i.test(url) ? url : undefined }

function UsersPanel({ token, onChanged }: { token: string; onChanged: () => Promise<void> }) {
  const [field, setField] = useState('nickname')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState({ field: 'nickname', search: '', version: 0 })
  const [users, setUsers] = useState<AdminUser[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setUsers([]); setCursor(null)
    void searchAdminUsers(token, query.field, query.search).then(result => { if (!cancelled) { setUsers(result.users); setCursor(result.nextCursor) } }).catch(e => { if (!cancelled) setError(errorText(e)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, query])
  async function more() {
    if (!cursor) return
    setLoading(true); setError('')
    try { const result = await searchAdminUsers(token, query.field, query.search, cursor); setUsers(previous => [...previous, ...result.users]); setCursor(result.nextCursor) }
    catch (e) { setError(errorText(e)) } finally { setLoading(false) }
  }
  return <><section className="admin-panel"><form className="admin-user-search" onSubmit={e => { e.preventDefault(); setQuery({ field, search: search.trim(), version: query.version + 1 }) }}><label><span>검색 항목</span><select value={field} onChange={e => setField(e.target.value)} disabled={loading}><option value="nickname">닉네임</option><option value="username">사용자 이름</option><option value="uid">UID</option></select></label><label className="admin-search-input"><span>{field === 'uid' ? '정확한 값 입력' : '시작하는 글자로 검색'}</span><input value={search} onChange={e => setSearch(e.target.value)} maxLength={200} placeholder="비워 두면 전체 유저를 보여 드려요" disabled={loading} /></label><button className="button button-primary" disabled={loading}><Search size={17} />검색</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="admin-table-scroll"><table className="admin-user-table"><thead><tr><th>유저</th><th>가입일</th><th>상태</th><th>관리</th></tr></thead><tbody>{users.map(user => <tr key={user.uid}><td><div className="admin-user-identity">{user.photoURL ? <img src={safeImage(user.photoURL)} alt="" /> : <span>{user.nickname.slice(0, 1) || 'S'}</span>}<div><strong>{user.nickname || '이름 없음'}</strong><small>@{user.username || '미설정'}</small></div></div></td><td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '기록 없음'}</td><td><span className={`case-badge ${user.suspended ? 'dismissed' : 'resolved'}`}>{user.suspended ? '이용 정지' : '정상'}</span></td><td><button className="button button-secondary" onClick={() => setSelected(user)} aria-label={`${user.nickname} 관리`}>관리</button></td></tr>)}</tbody></table></div>
    {loading && <p className="empty-text" role="status">유저를 불러오는 중…</p>}{!loading && !users.length && !error && <p className="empty-text">검색된 유저가 없습니다.</p>}{cursor && <button className="button button-secondary" disabled={loading} onClick={() => void more()}>더 보기</button>}
  </section>{selected && <UserDetail key={selected.uid} user={selected} token={token} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setQuery(previous => ({ ...previous, version: previous.version + 1 })); void onChanged() }} />}</>
}

function UserDetail({ user, token, onClose, onSaved }: { user: AdminUser; token: string; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await manageAdminUser(token, user.uid, !user.suspended, reason); onSaved() }
    catch (e) { setError(errorText(e)); setBusy(false) }
  }
  return <AdminDialog title="유저 상세·관리" busy={busy} onClose={onClose}><h3>{user.nickname} <small>@{user.username}</small></h3><dl className="admin-user-details"><dt>UID</dt><dd>{user.uid}</dd><dt>가입일</dt><dd>{date(user.createdAt)}</dd><dt>상태</dt><dd>{user.suspended ? '이용 정지' : '정상'}</dd><dt>소개</dt><dd className="preserve-text">{user.bio || '없음'}</dd>{user.suspensionReason && <><dt>최근 처리 사유</dt><dd>{user.suspensionReason}</dd></>}</dl><form className="form" onSubmit={submit}><label>{user.suspended ? '정지 해제' : '이용 정지'} 사유<textarea rows={3} required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} placeholder="처리 근거를 남겨 주세요." /></label><p className="report-notice">{user.suspended ? '해제하면 다시 로그인해 서비스를 이용할 수 있습니다.' : '정지하면 로그인이 차단되고 기존 로그인 세션에서도 핀·채팅을 이용할 수 없습니다.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<button className={`button ${user.suspended ? 'button-primary' : 'button-danger'}`} disabled={busy || !reason.trim()}>{busy ? '처리 중…' : user.suspended ? '이용 정지 해제' : '이용 정지 적용'}</button></form></AdminDialog>
}

function AdminDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  return <dialog className="admin-dialog" ref={node => { if (node && !node.open) node.showModal() }} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="button-icon" disabled={busy} onClick={onClose} aria-label="상세 창 닫기"><X size={20} /></button></div>{children}</dialog>
}
