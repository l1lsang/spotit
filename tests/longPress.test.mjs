import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLongPress } from '../src/lib/longPress.ts'

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const onHold = t.mock.fn()
  return { press: createLongPress(onHold), onHold, tick: ms => t.mock.timers.tick(ms) }
}

test('holding a message opens actions once after half a second', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  tick(499)
  assert.equal(onHold.mock.callCount(), 0)
  tick(1)
  assert.equal(onHold.mock.callCount(), 1)
  tick(1000)
  assert.equal(onHold.mock.callCount(), 1)
})

test('a short tap keeps photo navigation and does not open actions', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  tick(100)
  press.cancel()
  tick(1000)
  assert.equal(onHold.mock.callCount(), 0)
  assert.equal(press.consumeClick(), false)
})

test('scrolling cancels a hold even if the pointer returns to its start', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  press.move(50, 65)
  press.move(50, 50)
  tick(1000)
  assert.equal(onHold.mock.callCount(), 0)
})

test('small finger movement still allows a hold', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  press.move(53, 54)
  tick(500)
  assert.equal(onHold.mock.callCount(), 1)
})

test('releasing a held photo suppresses the click, but a later tap works', t => {
  const { press, tick } = setup(t)
  press.start(50, 50)
  tick(500)
  press.cancel()
  assert.equal(press.consumeClick(), true)
  press.start(50, 50)
  press.cancel()
  assert.equal(press.consumeClick(), false)
})

test('context menu opens immediately and clears the pending hold', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  tick(100)
  press.open()
  assert.equal(onHold.mock.callCount(), 1)
  tick(1000)
  assert.equal(onHold.mock.callCount(), 1)
})

test('pointer cancellation or unmount clears the pending action', t => {
  const { press, onHold, tick } = setup(t)
  press.start(50, 50)
  press.cancel()
  tick(1000)
  assert.equal(onHold.mock.callCount(), 0)
})
