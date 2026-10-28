# Jagame Docker staging — draft

This builds two isolated services: PHP CodeIgniter and Node Socket.IO gateway. Local-only port 127.0.0.1:16969. No NPM, no Cloudflare Tunnel.

**Status:** initial build test only; functionality and safe operation are unverified. Do not run on the shared homelab host until the complete code/runtime dependencies have been assessed. Initial execution of protected/encoded source is safer in a dedicated disposable VM.

The Node gateway's default PHP upstream currently appears to target loopback. In Docker it must point to the PHP service. This is a known compatibility blocker until verified and addressed with a clean implementation/configuration. Other dependencies including bundled runtime and auto-update have not yet been verified.

No code is automatically deployed. No external port is published. The WebSocket gateway is not yet considered working.
