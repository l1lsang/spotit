import { useId, useState } from 'react'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import cafePhoto from '../../assets/landing/cafe.webp'
import sunsetPhoto from '../../assets/landing/sunset.webp'
import walkPhoto from '../../assets/landing/walk.webp'

const moments = [
  { id: 'walk', photo: walkPhoto, title: '조금 더 걷고 싶은 날', place: '성북천, 서울', category: '산책', caption: '날씨가 좋아서 한참 걸었다. 늘 지나던 길인데, 오늘은 조금 달라 보였다.', alt: '초록 나무와 오후 햇살이 드리운 성북천 산책길' },
  { id: 'cafe', photo: cafePhoto, title: '계획에 없던 쉬어감', place: '성신여대입구, 서울', category: '카페', caption: '걷다가 발견한 작은 카페. 커피 한 잔을 마시는 동안, 오후가 느리게 흘렀다.', alt: '커피 한 잔과 함께 쉬어가는 작은 카페의 풍경' },
  { id: 'sunset', photo: sunsetPhoto, title: '해가 질 때까지', place: '한강, 서울', category: '풍경', caption: '별일 없이 앉아 있어도 좋았던 곳. 다음엔 친구랑 같이 와야지.', alt: '저녁 노을이 강물 위로 번지는 한강의 풍경' },
] as const

export function LandingHero() {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const moment = moments[selected]
  return (
    <section className="moment-gallery" aria-label="장소 기록 예시">
      <figure className="moment-feature" id={`${id}-preview`} aria-live="polite" aria-atomic="true">
        <div className="moment-photo">
          <img key={moment.id} src={moment.photo} alt={moment.alt} width="640" height="640" fetchPriority="high" />
          <span className="moment-location"><MapPin size={15} aria-hidden="true" />{moment.place}</span>
        </div>
        <figcaption className="moment-story">
          <div className="moment-story-top"><span>이렇게 기록해요</span><span>{moment.category}</span></div>
          <div className="moment-story-body"><h2>{moment.title}</h2><p>{moment.caption}</p></div>
          <Link className="text-link" to="/map">나의 장소 남기기 <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </figcaption>
      </figure>
      <div className="moment-picker" role="group" aria-label="다른 장소 기록 보기">
        {moments.map((item, index) => <button key={item.id} className="moment-choice" type="button" aria-pressed={selected === index} aria-controls={`${id}-preview`} onClick={() => setSelected(index)}>
          <img src={item.photo} alt="" width="56" height="56" />
          <span><strong>{item.place.split(',')[0]}</strong><small>{item.category}</small></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>)}
      </div>
    </section>
  )
}
