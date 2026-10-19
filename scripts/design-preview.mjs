// Explicit design preview: real application components, local JSON content.
// Firebase clients are disabled; mutations only affect this browser's fixtures.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'design/preview/fixtures.js')
const hooks = {
  useAuth: `import {profile} from '/__design-fixtures.js';
    const guest=['/','/login','/signup'].includes(location.pathname)||new URLSearchParams(location.search).has('guest');
    const auth={currentUser:guest?null:{uid:profile.uid,email:profile.email,displayName:profile.nickname},profile:guest?null:profile,firebaseReady:true,loading:false,profileError:'',refreshProfile:async()=>{}};
    export function useAuth(){return auth}`,
  useGroups: `import {groups} from '/__design-fixtures.js';const result={groups,joinedIds:['group-0'],loading:false,error:'',retry:()=>{}};export function useGroups(){return result}`,
  useUnreadNotifications: `export function useUnreadNotifications(){return 1}`,
  useCurrentLocation: `export const SEOUL_CITY_HALL={lat:37.566535,lng:126.9779692};const requestLocation=async()=>SEOUL_CITY_HALL;export function useCurrentLocation(){return {location:SEOUL_CITY_HALL,loading:false,error:'',requestLocation}}`,
}
const services = {
  userService: `export async function listUsers(){return users} export async function getUserProfile(id){return users.find(u=>u.uid===id)||profile}`,
  postService: `export async function getVisiblePostPage(){return {posts,nextCursor:null}}
    export async function getVisiblePosts(){return posts} export async function getUserPosts(){return posts}
    export async function getProfilePosts(){return {access:'visible',posts}}
    export async function getPostById(id){return posts.find(p=>p.id===id)}
    export function subscribeGroupPosts(id,cb){cb(posts);return ()=>{}}
    export function subscribeToLikedPosts(id,cb){cb(posts);return ()=>{}}
    export async function updatePost(id,input,photoUrls){const post=posts.find(p=>p.id===id);if(post)Object.assign(post,input,{photoUrls,photoThumbnailUrls:photoUrls})}
    export async function deletePost(id){const index=posts.findIndex(p=>p.id===id);if(index>=0)posts.splice(index,1)}`,
  followService: `export async function isFollowing(){return false} export async function hasPendingFollowRequest(){return false}
    export async function getOutgoingFollowRequestIds(){return []} export async function getFollowingIds(){return ['person-0']}
    export async function getFollowers(){return users.slice(1)} export async function getFollowing(){return users.slice(1)}
    export async function getIncomingFollowRequests(){return []}`,
  chatService: `export function subscribeToMyChats(uid,cb){cb(chats);return ()=>{}}
    export function subscribeToChat(id,uid,cb){cb(chats.find(c=>c.id===id));return ()=>{}}
    export function subscribeToChatMessages(id,cb){cb(messages);return ()=>{}}
    export async function markChatAsRead(){} export async function refreshChatParticipant(){}
    export async function getChatById(id){return chats.find(c=>c.id===id)} export async function getChatInviteCandidates(){return users.slice(1)}`,
  likeService: `export function subscribeToPostReactions(id,cb){cb({likeCount:posts.find(p=>p.id===id)?.likeCount||0,commentCount:0});return ()=>{}} export function subscribeToLikeStatus(id,uid,cb){cb(false);return ()=>{}}`,
  commentService: `export function subscribeToComments(id,cb){cb([]);return ()=>{}}`,
  notificationService: `export function subscribeToNotifications(id,cb){cb(notifications);return ()=>{}} export function subscribeToUnreadNotificationCount(id,cb){cb(1);return ()=>{}}`,
  groupService: `export async function getGroupInviteCode(){return 'SPOTIT24'} export function subscribeGroups(cb){cb(groups);return ()=>{}} export function subscribeMyGroupIds(uid,cb){cb(['group-0']);return ()=>{}}`,
  mapFeatureService: `export function subscribePlaceStatusUpdates(...args){args.find(a=>typeof a==='function')?.([]);return ()=>{}}`,
  pushNotificationService: `export async function getPushPermissionStatus(){return 'unsupported'} export async function subscribeToForegroundPushMessages(){return ()=>{}}`,
  moderationService: `export async function listMyCases(){return {cases}}`,
}

const plugin = {
  name: 'spotit-design-preview',
  enforce: 'pre',
  resolveId(id) { if (id === '/__design-fixtures.js') return '\0spotit-design-fixtures' },
  load(id) {
    if (id === '\0spotit-design-fixtures') return fs.readFileSync(fixturePath, 'utf8')
    const file = id.replaceAll('\\', '/')
    if (file.includes('design-original')) return null
    if (file.endsWith('/src/contexts/AuthContext.tsx')) return 'export function AuthProvider({children}){return children}'
    if (file.endsWith('/src/contexts/LocationConsentProvider.tsx')) return `import {createElement} from 'react';import {LocationConsentContext} from '/src/contexts/locationConsentCore.ts';const allowPreviewEdit=async()=>true;export function LocationConsentProvider({children}){return createElement(LocationConsentContext.Provider,{value:allowPreviewEdit},children)}`
    if (file.endsWith('/src/components/layout/ForegroundPushListener.tsx')) return 'export function ForegroundPushListener(){return null}'
    if (file.endsWith('/src/components/layout/PushPermissionPrompt.tsx')) return 'export function PushPermissionPrompt(){return null}'
    if (file.endsWith('/src/lib/firebase.ts')) return `export const firebaseApp=null,auth=null,db=null,storage=null,isFirebaseConfigured=true,missingFirebaseEnvKeys=[],firebaseInitializationError='',firebaseConfigMessage='';
      export function requireAuth(){throw Error('디자인 미리보기에서는 이 기능을 사용할 수 없습니다.')}
      export function requireDb(){throw Error('디자인 미리보기에서는 이 기능을 사용할 수 없습니다.')}
      export function requireStorage(){throw Error('디자인 미리보기에서는 파일을 저장할 수 없습니다.')}`
    const name = path.basename(file).replace(/\.tsx?$/, '')
    if (file.includes('/src/hooks/') && hooks[name]) return hooks[name]
    if (file.includes('/src/services/') && services[name]) return `export * from '/src/services/${name}.ts?design-original';import {profile,users,posts,chats,messages,notifications,groups,cases} from '/__design-fixtures.js';${services[name]}`
    return null
  },
  transformIndexHtml(html) {
    return html.replace('</head>', `<script>localStorage.setItem('spotit-install-guide-seen-v1','1')</script></head>`)
  },
}

const server = await createServer({configFile:false,root,plugins:[plugin,react()],server:{host:'127.0.0.1',port:5241,strictPort:true,watch:{ignored:['**/.verification.local/**','**/*-debug.log']}}})
await server.listen()
console.log('Spotit Figma preview: http://127.0.0.1:5241/feed')
