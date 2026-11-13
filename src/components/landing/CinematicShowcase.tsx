import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { AppStoreButtons } from '../layout/AppStoreButtons'
import { PhoneMockup, PhoneScreenImage, PhoneSplash } from '../site/PhoneMockup'
import {
  screens, screenSpots, showcaseScene, showcaseScenes, type MediaAsset, type SceneId, type ShowcaseScene,
} from '../../data/showcase'
import { useMediaQuery } from '../../hooks/useMediaQuery'

gsap.registerPlugin(ScrollTrigger)

/** Wide layout: copy on the left, phone centre-right. Everything else stacks copy over the phone. */
const WIDE = '(min-width: 1024px) and (min-aspect-ratio: 1/1)'
const REDUCED = '(prefers-reduced-motion: reduce)'
/** Timeline length in "screens" of scrolling; the section is one screen taller than this. */
const TOTAL = 5

const phoneOrder = [screens.home, screens.photo, screens.feed, screens.details, screens.pin]

export function CinematicShowcase() {
  return useMediaQuery(REDUCED) ? <StaticShowcase /> : <Cinematic />
}

function media(scene: ShowcaseScene, wide: boolean): MediaAsset {
  return wide ? scene.background : scene.mobileBackground ?? scene.background
}

function SceneCopy({ scene, level }: { scene: ShowcaseScene; level: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <>
      <Heading className="cine-title">{scene.title.map((line, index) => <span key={index}>{line}</span>)}</Heading>
      {scene.description && <p className="cine-lead">{scene.description.map((line, index) => <span key={index}>{line}</span>)}</p>}
    </>
  )
}

function Halo({ spot, id }: { spot: typeof screenSpots.homePin; id: string }) {
  return (
    <span className={`cine-halo${spot.round ? ' cine-halo-round' : ''}`} data-halo={id} aria-hidden="true"
      style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${spot.size * 100}%` }} />
  )
}

function Cinematic() {
  const wide = useMediaQuery(WIDE)
  const sectionRef = useRef<HTMLElement>(null)
  const [mediaIn, setMediaIn] = useState(false)
  const beginning = media(showcaseScene('beginning'), wide)
  const sunset = media(showcaseScene('moment'), wide)
  const cafe = media(showcaseScene('yours'), wide)
  const place = media(showcaseScene('place'), wide)

  preload(beginning.poster!, { as: 'image', fetchPriority: 'high' })

  // Scene 01: the copy shows on white first, then the film fades in behind it.
  useEffect(() => {
    const timer = window.setTimeout(() => setMediaIn(true), 450)
    return () => window.clearTimeout(timer)
  }, [])

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const q = gsap.utils.selector(section)
    const stage = q('.cine-stage')[0] as HTMLElement
    const plate = q('.cine-plate')[0] as HTMLElement

    // Play only the films that are on screen; the second loads when it is first needed.
    const playing: Partial<Record<SceneId, boolean>> = {}
    const setPlaying = (id: SceneId, want: boolean) => {
      if (playing[id] === want) return
      playing[id] = want
      const video = section.querySelector<HTMLVideoElement>(`video[data-video="${id}"]`)
      if (!video) return
      if (want) {
        if (video.preload !== 'auto') video.preload = 'auto'
        void video.play().catch(() => { playing[id] = false }) // blocked (e.g. low-power mode): the poster stays
      } else video.pause()
    }
    const syncVideos = (t: number) => {
      setPlaying('beginning', t < 1.3)
      setPlaying('place', t > 0.6 && t < 3.6)
    }

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()
      mm.add({ wide: WIDE, narrow: `not all and ${WIDE}` }, context => {
        const isWide = Boolean(context.conditions?.wide)
        const asset = isWide ? showcaseScene('moment').background : showcaseScene('moment').mobileBackground!
        const [posX, posY] = (asset.objectPosition ?? '50% 50%').split(' ').map(value => parseFloat(value) / 100)

        // Geometry for the sunset expansion, measured on the untransformed phone slot.
        const geo = { w: 0, h: 0, x0: 0, y0: 0, k0: 1, clip0: 0, x1: 0, y1: 0, vh: 0 }
        const measure = () => {
          const stageBox = stage.getBoundingClientRect()
          const slot = q('.cine-phone-slot')[0].getBoundingClientRect()
          const screen = q('.cine-phone .phone-screen')[0] as HTMLElement
          const sw = screen.clientWidth
          const sh = screen.clientHeight
          const vw = stage.clientWidth
          const vh = stage.clientHeight
          const cover = Math.max(vw / asset.width!, vh / asset.height!)
          const w = asset.width! * cover
          const h = asset.height! * cover
          const photoX = slot.left - stageBox.left + slot.width / 2 - sw / 2
          const photoY = slot.top - stageBox.top + slot.height / 2 - sh / 2 + sh * screenSpots.feedPhoto.top
          const photoH = sh * screenSpots.feedPhoto.height
          const k0 = sw / w
          Object.assign(geo, {
            w, h, k0, vh,
            x0: photoX,
            y0: photoY + photoH / 2 - (h * k0) / 2,
            // The feed shows a centred square crop: clip the rest away, in the plate's own units.
            clip0: (h - photoH / k0) / 2,
            x1: (vw - w) * posX,
            y1: (vh - h) * posY,
          })
          plate.style.width = `${w}px`
          plate.style.height = `${h}px`
        }
        measure()
        ScrollTrigger.addEventListener('refreshInit', measure)

        const layer = (id: string) => q(`.phone-layer[data-screen="${id}"]`)
        const copy = (id: SceneId) => q(`.cine-copy[data-scene="${id}"]`)
        const bg = (id: SceneId) => q(`.cine-bg[data-scene="${id}"]`)
        const motion = q('.cine-phone-motion')
        const overlay = q('.cine-overlay')
        const copyIn = { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' }
        const copyOut = { autoAlpha: 0, y: -28, duration: 0.22, ease: 'power1.in' }
        const screenIn = { autoAlpha: 1, duration: 0.16 }

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: section,
            start: 0,
            end: 'bottom bottom',
            scrub: isWide ? 0.6 : 0.35,
            invalidateOnRefresh: true,
            onUpdate: self => syncVideos(self.progress * TOTAL),
            onRefresh: self => syncVideos(self.progress * TOTAL),
          },
        })

        tl.set(q('.cine-copy:not([data-scene="beginning"])'), { autoAlpha: 0, y: 28 }, 0)

        // 01 · The phone rises from below and its screen wakes on the PINORI mark.
        tl.fromTo(motion, { y: () => geo.vh * (isWide ? 0.62 : 0.55), scale: 0.96 },
          { y: 0, scale: 1, duration: 0.55, ease: 'power2.out' }, 0)
          .fromTo(motion, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0)
          .to(q('.phone-off'), { autoAlpha: 0, duration: 0.25 }, 0.35)
          .to(layer('home'), screenIn, 0.75)
          .to(copy('beginning'), copyOut, 0.7)

        // 02 · City film to street film; the map stays and its pin is marked.
          .to(bg('place'), { autoAlpha: 1, duration: 0.35 }, 0.85)
          .to(overlay, { opacity: showcaseScene('place').overlayOpacity, duration: 0.35 }, 0.85)
          .fromTo(q('.cine-bg[data-scene="beginning"] .cine-media'), { scale: 1 }, { scale: 1.06, duration: 1.3 }, 0)
          .fromTo(q('.cine-bg[data-scene="place"] .cine-media'), { scale: 1 }, { scale: 1.06, duration: 1.4 }, 0.85)
          .to(copy('place'), copyIn, 1.0)
          .to(q('[data-halo="home"]'), { autoAlpha: 1, duration: 0.12 }, 1.15)
          .to(motion, { y: isWide ? -18 : -10, duration: 1.0 }, 0.95)
          .to(q('[data-halo="home"]'), { autoAlpha: 0, duration: 0.1 }, 1.8)
          .to(copy('place'), copyOut, 1.95)
          .to(motion, { y: 0, duration: 0.2 }, 1.95)

        // 03 · The photo is found, the post appears, and its sunset opens out to fill the screen.
          .to(layer('photo'), screenIn, 2.1)
          .to(q('[data-halo="photo"]'), { autoAlpha: 1, duration: 0.1 }, 2.3)
          .to(q('[data-halo="photo"]'), { autoAlpha: 0, duration: 0.1 }, 2.62)
          .to(layer('feed'), screenIn, 2.68)
          .fromTo(plate, {
            autoAlpha: 0, x: () => geo.x0, y: () => geo.y0, scale: () => geo.k0,
            clipPath: () => `inset(${geo.clip0}px 0px ${geo.clip0}px 0px)`,
          }, { autoAlpha: 1, duration: 0.06 }, 2.9)
          .to(plate, {
            x: () => geo.x1, y: () => geo.y1, scale: 1, clipPath: 'inset(0px 0px 0px 0px)',
            duration: 0.55, ease: 'power2.inOut',
          }, 2.96)
          // The phone stays put while the photo lifts out of it, and goes only once the photo covers it.
          .to(motion, { autoAlpha: 0, duration: 0.08 }, 3.14)
          .to(overlay, { opacity: showcaseScene('moment').overlayOpacity, duration: 0.3 }, 3.3)
          .to(q('.cine-plate img'), { scale: 1.05, duration: 0.9 }, 3.5)
          .fromTo(motion, { y: 40, scale: 0.94 }, { y: 0, scale: 1, duration: 0.3, ease: 'power2.out', immediateRender: false }, 3.5)
          .to(motion, { autoAlpha: 1, duration: 0.2 }, 3.5)
          .to(copy('moment'), copyIn, 3.55)
          .to(copy('moment'), copyOut, 4.0)

        // 04 · A quieter café photograph; the phone carries the scene from the record to its pin colour.
          .to(bg('yours'), { autoAlpha: 1, duration: 0.35 }, 4.0)
          .to(overlay, { opacity: showcaseScene('yours').overlayOpacity, duration: 0.35 }, 4.0)
          .fromTo(q('.cine-bg[data-scene="yours"] .cine-media'), { scale: 1.02 }, { scale: 1.09, duration: 1.0 }, 4.0)
          .to(layer('details'), screenIn, 4.15)
          .to(copy('yours'), copyIn, 4.3)
          .to(layer('pin'), screenIn, 4.65)
          .to({}, { duration: 0.01 }, TOTAL - 0.01)

        syncVideos(tl.scrollTrigger!.progress * TOTAL)
        return () => {
          ScrollTrigger.removeEventListener('refreshInit', measure)
          setPlaying('beginning', false)
          setPlaying('place', false)
        }
      })
    }, section)

    // Late layout changes (fonts, images) move the trigger points: refresh once everything has settled.
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    return () => {
      window.removeEventListener('load', refresh)
      ctx.revert()
    }
  }, [])

  return (
    <section ref={sectionRef} id="showcase" className="cine" data-media-in={mediaIn} aria-label="피노리 소개">
      <div className="cine-stage">
        <div className="cine-backdrop" aria-hidden="true">
          {[{ id: 'beginning' as const, asset: beginning }, { id: 'place' as const, asset: place }].map(({ id, asset }) => (
            <div key={id} className="cine-bg" data-scene={id}>
              <img className="cine-media" src={asset.poster} alt="" style={{ objectPosition: asset.objectPosition }}
                fetchPriority={id === 'beginning' ? 'high' : 'low'} decoding="async" />
              <video key={asset.src} className="cine-media cine-video" data-video={id} src={asset.src} poster={asset.poster}
                muted loop playsInline preload={id === 'beginning' ? 'auto' : 'none'} disablePictureInPicture
                style={{ objectPosition: asset.objectPosition }}
                onPlaying={event => { event.currentTarget.dataset.playing = 'true' }} />
            </div>
          ))}
          <div className="cine-plate">
            <img src={sunset.src} alt="" width={sunset.width} height={sunset.height} decoding="async" fetchPriority="low" />
          </div>
          <div className="cine-bg" data-scene="yours">
            <img className="cine-media" src={cafe.src} alt="" style={{ objectPosition: cafe.objectPosition }}
              decoding="async" fetchPriority="low" />
          </div>
          <div className="cine-overlay" style={{ opacity: showcaseScene('beginning').overlayOpacity }} />
        </div>

        <div className="site-wrap cine-content">
          <div className="cine-copies">
            {showcaseScenes.map(scene => (
              <div key={scene.id} className="cine-copy" data-scene={scene.id}>
                <SceneCopy scene={scene} level={scene.id === 'beginning' ? 1 : 2} />
                {scene.id === 'beginning' && <AppStoreButtons primary />}
              </div>
            ))}
          </div>
          <div className="cine-phone-slot">
            <div className="cine-phone-motion">
              <PhoneMockup className="cine-phone">
                <div className="phone-layer" data-screen="splash" style={{ opacity: 1 }}><PhoneSplash /></div>
                {phoneOrder.map(screen => (
                  <div key={screen.id} className="phone-layer" data-screen={screen.id}>
                    <PhoneScreenImage screen={screen} priority={screen.id === 'home'} />
                  </div>
                ))}
                <span className="phone-off" aria-hidden="true" />
                <Halo spot={screenSpots.homePin} id="home" />
                <Halo spot={screenSpots.photoMarker} id="photo" />
              </PhoneMockup>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Reduced motion: every scene as a still panel, with the same copy, photographs and screens. */
function StaticShowcase() {
  const wide = useMediaQuery(WIDE)
  const phoneFor: Partial<Record<SceneId, typeof screens.home>> = { beginning: screens.home, moment: screens.feed, yours: screens.details }
  return (
    <section id="showcase" className="cine-static" aria-label="피노리 소개">
      {showcaseScenes.map(scene => {
        const asset = media(scene, wide)
        const still = asset.type === 'video' ? asset.poster : asset.src
        const phone = phoneFor[scene.id]
        return (
          <div key={scene.id} className="cine-static-scene" data-scene={scene.id}>
            <img className="cine-static-bg" src={still} alt="" style={{ objectPosition: asset.objectPosition }}
              loading={scene.id === 'beginning' ? 'eager' : 'lazy'} decoding="async" />
            <div className="cine-static-overlay" style={{ opacity: scene.overlayOpacity }} />
            <div className="site-wrap cine-static-inner">
              <div className="cine-copy">
                <SceneCopy scene={scene} level={scene.id === 'beginning' ? 1 : 2} />
                {scene.id === 'beginning' && <AppStoreButtons primary />}
              </div>
              {phone && <PhoneMockup className="cine-static-phone"><PhoneScreenImage screen={phone} /></PhoneMockup>}
            </div>
          </div>
        )
      })}
    </section>
  )
}
