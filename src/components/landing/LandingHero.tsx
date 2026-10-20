import { useId, useState } from 'react'
import { ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import cafePhoto from '../../assets/landing/cafe.webp'
import sunsetPhoto from '../../assets/landing/sunset.webp'
import walkPhoto from '../../assets/landing/walk.webp'
import previewContent from '../../data/previewContent.json'

const previewPhotos: Record<string, string> = {
  '/src/assets/landing/walk.webp': walkPhoto,
  '/src/assets/landing/cafe.webp': cafePhoto,
  '/src/assets/landing/sunset.webp': sunsetPhoto,
}

const posts = previewContent.posts.map(post => ({
  ...post,
  photoUrls: post.photoUrls.map(url => previewPhotos[url] ?? url),
}))

export function LandingHero() {
  const [selected, setSelected] = useState(0)
  const id = useId()
  const post = posts[selected]

  if (!post) return null

  return (
    <section className="moment-gallery" aria-label="장소 기록 예시">
      <figure className="moment-feature" id={`${id}-preview`} aria-live="polite" aria-atomic="true">
        <div className="moment-photo">
          <img key={post.id} src={post.photoUrls[0]} alt={post.title} width="640" height="640" fetchPriority="high" />
          <span className="moment-location"><MapPin size={15} aria-hidden="true" />{post.placeName}, {post.address}</span>
        </div>
        <figcaption className="moment-story">
          <div className="moment-story-top"><span>이렇게 기록해요</span><span>{post.authorNickname}</span></div>
          <div className="moment-story-body"><h2>{post.title}</h2><p>{post.content}</p></div>
          <Link className="text-link" to="/map">나의 장소 남기기 <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </figcaption>
      </figure>
      <div className="moment-picker" role="group" aria-label="다른 장소 기록 보기">
        {posts.map((item, index) => <button key={item.id} className="moment-choice" type="button" aria-pressed={selected === index} aria-controls={`${id}-preview`} onClick={() => setSelected(index)}>
          <img src={item.photoUrls[0]} alt="" width="56" height="56" />
          <span><strong>{item.placeName}</strong><small>{item.authorNickname}</small></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>)}
      </div>
    </section>
  )
}
