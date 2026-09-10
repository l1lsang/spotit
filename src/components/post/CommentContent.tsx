import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { getMentionTokens } from '../../lib/commentMentions'

export function CommentContent({ content, mentions = {} }: { content: string; mentions?: Record<string, string> }) {
  const tokens = getMentionTokens(content)
  const parts = tokens.map((token, index) => {
    const prefix = content.slice(index ? tokens[index - 1].end : 0, token.start)
    const label = content.slice(token.start, token.end)
    const uid = Object.hasOwn(mentions, `@${token.username}`) ? mentions[`@${token.username}`] : ''
    return <Fragment key={token.start}>{prefix}{uid
      ? <Link className="comment-mention" to={`/people/${encodeURIComponent(uid)}`}>{label}</Link> : label}</Fragment>
  })
  return <>{parts}{content.slice(tokens.at(-1)?.end || 0)}</>
}
