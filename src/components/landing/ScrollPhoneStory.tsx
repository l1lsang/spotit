import { useEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { AppStoreButtons } from '../layout/AppStoreButtons'
import { PhoneMockup, PhoneScreenImage, PhoneSplash } from '../site/PhoneMockup'
import {
  heroCopy, PHONE_RISE_END, screens, screenSrc, staticStepScreens, storyLayers, storySteps,
} from '../../data/showcase'
import { useMediaQuery } from '../../hooks/useMediaQuery'

/** The pinned scroll story runs only where it reads well: wide, tall enough, motion allowed. */
const PINNED_QUERY = '(min-width: 768px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)'

function HeroText({ headingLevel = 1 }: { headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <>
      <Heading className="hero-title">{heroCopy.title[0]}<br />{heroCopy.title[1]}</Heading>
      <p className="hero-lead">{heroCopy.lead}</p>
      <AppStoreButtons primary />
    </>
  )
}

export function ScrollPhoneStory() {
  const { src, srcSet } = screenSrc(screens.home.file)
  preload(src, { as: 'image', imageSrcSet: srcSet, imageSizes: '320px', fetchPriority: 'high' })
  return useMediaQuery(PINNED_QUERY) ? <PinnedStory /> : <StaticStory />
}

function layerIndexAt(progress: number) {
  const index = storyLayers.findIndex(layer => progress < layer.until)
  return index === -1 ? storyLayers.length - 1 : index
}

/** Desktop and tablet: a sticky stage whose phone rises, boots and changes screens with the scroll. */
function PinnedStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [layerIndex, setLayerIndex] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    if (!section || !stage) return
    let frame = 0
    const update = () => {
      frame = 0
      // 0 at the page top, 1 when the stage unpins, so the phone answers the very first scroll.
      const sectionTop = section.getBoundingClientRect().top + window.scrollY
      const distance = sectionTop + section.offsetHeight - window.innerHeight
      const progress = distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0
      stage.style.setProperty('--rise', Math.min(1, progress / PHONE_RISE_END).toFixed(4))
      setLayerIndex(layerIndexAt(progress))
    }
    const request = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
    }
  }, [])

  const activeCopy = storyLayers[layerIndex].copy
  const activeStep = storySteps.findIndex(step => step.id === activeCopy)

  return (
    <section ref={sectionRef} className="story story-pinned" aria-label="피노리 소개와 기록 과정">
      <span id="story" className="story-anchor" />
      <div ref={stageRef} className="story-stage">
        <div className="site-wrap story-grid">
          <div className="story-copy">
            <div className="story-block story-hero" data-active={activeCopy === 'hero'} data-enter>
              <HeroText />
            </div>
            {storySteps.map((step, index) => (
              <div key={step.id} className="story-block" data-active={activeCopy === step.id}>
                <p className="story-count">{String(index + 1).padStart(2, '0')} · {step.label}</p>
                <h2 className="story-title">{step.title}</h2>
                <p className="story-body">{step.body}</p>
              </div>
            ))}
            <ol className="story-steps" data-visible={activeStep >= 0} aria-hidden="true">
              {storySteps.map((step, index) => (
                <li key={step.id} data-active={index === activeStep} data-done={index < activeStep}>{step.label}</li>
              ))}
            </ol>
          </div>
          <div className="story-phone-slot" data-enter>
            <PhoneMockup className="story-phone">
              {storyLayers.map((layer, index) => (
                <div key={layer.id} className={`phone-layer phone-layer-${layer.id}`}
                  data-shown={index <= layerIndex} style={{ zIndex: index }}>
                  {layer.screen ? <PhoneScreenImage screen={layer.screen} priority={layer.id === 'home'}
                    hidden={index !== layerIndex} />
                    : layer.id === 'splash' ? <PhoneSplash /> : null}
                </div>
              ))}
            </PhoneMockup>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Phones and reduced motion: the same story as plain rows, no pinning and no scroll-driven motion. */
function StaticStory() {
  return (
    <>
      <section className="story-static-hero" aria-label="피노리 소개">
        <div className="site-wrap story-static-hero-inner">
          <div className="story-static-copy" data-enter><HeroText /></div>
          <PhoneMockup className="story-static-phone story-static-hero-phone">
            <PhoneScreenImage screen={screens.home} priority />
          </PhoneMockup>
        </div>
      </section>
      <section id="story" className="story-static" aria-labelledby="story-static-title">
        <div className="site-wrap">
          <h2 id="story-static-title" className="sr-only">피노리로 기록하는 과정</h2>
          <ol className="story-static-list">
            {storySteps.map((step, index) => (
              <li key={step.id} className="story-static-step">
                <div className="story-static-copy">
                  <p className="story-count">{String(index + 1).padStart(2, '0')} · {step.label}</p>
                  <h3 className="story-title">{step.title}</h3>
                  <p className="story-body">{step.body}</p>
                </div>
                <PhoneMockup className="story-static-phone">
                  <PhoneScreenImage screen={staticStepScreens[step.id]} />
                </PhoneMockup>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
