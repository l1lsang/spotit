import { useId } from 'react'
import { Bookmark, Heart, MapPin } from 'lucide-react'
import cafePhoto from '../../assets/landing/cafe.webp'
import sunsetPhoto from '../../assets/landing/sunset.webp'
import walkPhoto from '../../assets/landing/walk.webp'

const colors = {
  paper: '#FFFEFA',
  teal: '#3F7771',
  coral: '#D8795F',
  olive: '#8A985E',
  ink: '#242722',
  muted: '#7B8078',
  road: '#B8BCAE',
  line: '#E6E7DF',
}

// 사진과 문구는 여기서 수정합니다. 위치와 크기는 680 × 560 기준입니다.
const posts = [
  {
    id: 'cafe', photo: cafePhoto, title: '작은 카페 발견',
    caption: '걷다가 발견한 작은 카페', place: '성신여대입구', time: '2시간 전',
    x: 45, y: 36, rotation: -6, width: 178, height: 225,
    padding: 8, photoHeight: 125, gap: 10, color: colors.coral, likes: null,
  },
  {
    id: 'sunset', photo: sunsetPhoto, title: '노을이 예뻤던 곳',
    caption: '다음엔 친구랑 같이 와야지', place: '한강', time: '어제',
    x: 464, y: 103, rotation: 5, width: 192, height: 243,
    padding: 9, photoHeight: 140, gap: 10, color: colors.olive, likes: 12,
  },
  {
    id: 'walk', photo: walkPhoto, title: '성북천 산책',
    caption: '날씨가 좋아서 한참 걸었다', place: '성북구', time: '오늘',
    x: 218, y: 229, rotation: -2, width: 220, height: 280,
    padding: 10, photoHeight: 164, gap: 12, color: colors.teal, likes: 24,
  },
]

const roads = [
  'M22 110H305Q333 110 354 97L471 29',
  'M89 26V415Q89 441 113 454L176 489',
  'M18 301H99Q139 301 166 274L277 163Q298 142 332 142H658',
  'M378 35V152Q378 172 398 184L523 259Q547 274 547 297V490',
  'M67 384H618',
  'M597 82V262Q597 283 618 295L664 321',
  'M145 166V223M145 197H216M342 329H485',
]

const pins = [
  { x: 128, y: 321, size: 44, color: colors.teal },
  { x: 314, y: 81, size: 36, color: colors.coral },
  { x: 553, y: 376, size: 38, color: colors.olive },
]

export function LandingHero() {
  const id = useId()

  return (
    <svg
      className="landing-map-art"
      width={680}
      height={560}
      viewBox="0 0 680 560"
      fill="none"
      fontFamily="inherit"
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
    >
      <title id={`${id}-title`}>사진과 글로 남긴 나의 장소 기록</title>
      <desc id={`${id}-description`}>
        성북천 산책, 작은 카페에서 쉬어간 오후, 한강의 노을.
        세 장소에서 남긴 사진과 짧은 기록이 핀과 곡선 경로로 이어진 지도입니다.
      </desc>
      <defs>
        <filter id={`${id}-card-shadow`} x="-25%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="11" floodColor="#293A31" floodOpacity=".07" />
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#293A31" floodOpacity=".025" />
        </filter>
        <filter id={`${id}-pin-shadow`} x="-40%" y="-40%" width="190%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#293A31" floodOpacity=".07" />
        </filter>
        {posts.map(post => (
          <clipPath id={`${id}-photo-${post.id}`} key={post.id}>
            <rect
              x={post.padding} y={post.padding}
              width={post.width - post.padding * 2} height={post.photoHeight}
              rx={post.id === 'walk' ? 15 : 13}
            />
          </clipPath>
        ))}
      </defs>

      <g aria-hidden="true">
        <g stroke={colors.road} strokeWidth="1.2" strokeLinecap="round" opacity=".29">
          {roads.map(road => <path key={road} d={road} />)}
          <path d="M266 58V96M35 345H102M586 447H635" strokeDasharray="2 6" />
        </g>
        <g fill={colors.road} opacity=".35">
          <circle cx="89" cy="301" r="3.4" />
          <circle cx="378" cy="110" r="2.6" />
          <circle cx="597" cy="384" r="3" />
          <circle cx="647" cy="220" r="2" />
          <circle cx="36" cy="243" r="2.4" />
        </g>
        <path
          d="M87 445C102 471 166 482 218 478C291 471 326 514 409 510C486 506 478 457 554 465C578 468 594 486 615 480"
          stroke={colors.teal} strokeWidth="1.4" strokeLinecap="round" opacity=".38"
        />
        <g fill={colors.teal} opacity=".5">
          <circle cx="87" cy="445" r="3.1" />
          <circle cx="615" cy="480" r="3.1" />
        </g>
        <g strokeWidth="1.1" opacity=".48">
          <path d="M150 343C169 343 184 347 190 329C197 309 205 304 222 303" stroke={colors.teal} />
          <path d="M331 101C308 117 276 128 231 121" stroke={colors.coral} />
          <path d="M572 395C584 376 574 356 560 350" stroke={colors.olive} />
        </g>

        {posts.map(post => {
          const large = post.id === 'walk'
          const bodyY = post.padding + post.photoHeight + post.gap
          const titleLine = large ? 22 : 20
          const captionLine = large ? 20 : 18
          const gap = large ? 6 : 4
          const metaY = bodyY + titleLine + captionLine + gap * 2
          const actionX = post.width - post.padding - (post.likes === null ? 15 : 35) - 3
          const ActionIcon = post.likes === null ? Bookmark : Heart

          return (
            <g key={post.id} data-hero-post={post.id} transform={`translate(${post.x} ${post.y}) rotate(${post.rotation})`}>
              <rect
                width={post.width} height={post.height} rx={large ? 22 : 20}
                fill={colors.paper} stroke={colors.line} strokeWidth=".6"
                filter={`url(#${id}-card-shadow)`}
              />
              <image
                href={post.photo} x={post.padding} y={post.padding}
                width={post.width - post.padding * 2} height={post.photoHeight}
                preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-photo-${post.id})`}
              />
              <text
                x={post.padding + 4} y={bodyY + titleLine * .78}
                fill={colors.ink} fontSize={large ? 15.5 : 14} fontWeight="600"
              >{post.title}</text>
              <text
                x={post.padding + 4} y={bodyY + titleLine + gap + captionLine * .78}
                fill={colors.muted} fontSize={large ? 11.5 : 10.5}
              >{post.caption}</text>
              <MapPin x={post.padding + 4} y={metaY + 4} size={11} color={post.color} strokeWidth={1.7} />
              <text
                x={post.padding + 19} y={metaY + 13.3}
                fill={colors.muted} fontSize={large ? 10.2 : 9.1}
              >{post.place} · {post.time}</text>
              <ActionIcon x={actionX} y={metaY + 3} size={14} color={post.color} strokeWidth={1.7} />
              {post.likes !== null && (
                <text x={post.width - post.padding - 17} y={metaY + 13.2} fill={colors.muted} fontSize="9.5">
                  {post.likes}
                </text>
              )}
            </g>
          )
        })}

        {pins.map(pin => (
          <g key={pin.color} data-hero-pin transform={`translate(${pin.x} ${pin.y})`}>
            <circle cx={pin.size / 2} cy={pin.size / 2} r={pin.size / 2} fill={colors.paper} filter={`url(#${id}-pin-shadow)`} />
            <circle cx={pin.size / 2} cy={pin.size / 2} r={pin.size / 2 - 4} fill={pin.color} />
            <MapPin x={pin.size / 2 - 10} y={pin.size / 2 - 11} size={20} color={colors.paper} strokeWidth={1.7} />
          </g>
        ))}
        <text x="358" y="61" fontSize="11" letterSpacing="1.1" fill={colors.teal}>나의 장소 기록</text>
        <text x="76" y="382" fontSize="10" letterSpacing=".3" fill={colors.muted}>성북구</text>
        <text x="425" y="541" fontSize="11" letterSpacing=".1" fill={colors.muted}>순간이 모여, 나만의 지도</text>
      </g>
    </svg>
  )
}
