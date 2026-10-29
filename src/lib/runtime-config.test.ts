import { describe, expect, it } from 'vitest'
import { loadRuntimeConfig } from './runtime-config'

const valid = {
  supabaseUrl: 'https://abc.supabase.co',
  supabaseAnonKey: 'anon-key-that-is-long-enough',
}

function fakeFetch(body: string, ok = true): typeof fetch {
  return (async () => new Response(body, { status: ok ? 200 : 404 })) as typeof fetch
}

describe('loadRuntimeConfig', () => {
  it('đọc config.json hợp lệ', async () => {
    const state = await loadRuntimeConfig({}, fakeFetch(JSON.stringify(valid)))
    expect(state).toEqual({ status: 'configured', source: 'config.json', config: valid })
  })

  it('bỏ qua index.html do hosting SPA trả về và dùng biến môi trường', async () => {
    const state = await loadRuntimeConfig(
      { VITE_SUPABASE_URL: valid.supabaseUrl, VITE_SUPABASE_ANON_KEY: valid.supabaseAnonKey },
      fakeFetch('<!doctype html><html></html>'),
    )
    expect(state).toMatchObject({ status: 'configured', source: 'env' })
  })

  it('báo chưa cấu hình khi không có nguồn nào', async () => {
    const state = await loadRuntimeConfig({}, fakeFetch('', false))
    expect(state.status).toBe('unconfigured')
  })

  it('từ chối URL không phải http(s)', async () => {
    const bad = { ...valid, supabaseUrl: 'javascript:alert(1)' }
    const state = await loadRuntimeConfig({}, fakeFetch(JSON.stringify(bad)))
    expect(state.status).toBe('unconfigured')
  })
})
