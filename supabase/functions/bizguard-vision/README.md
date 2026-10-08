# BizGuard Vision

Deploy this Edge Function as `bizguard-vision`.

Required Supabase Edge Function secrets:
- `OPENAI_API_KEY`
- optional `OPENAI_VISION_MODEL` (defaults to `gpt-6-luna`)

The function authenticates the caller, verifies business membership, sends the image to the server-side vision provider, and returns a reviewable detection list. The OpenAI key is never shipped to the browser.
