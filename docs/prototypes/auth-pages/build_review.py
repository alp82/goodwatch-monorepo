"""Builds review.html: every screenshot of the account pages prototype (#534), inlined, with its open questions
numbered right under it. Run from anywhere: python3 docs/prototypes/auth-pages/build_review.py"""

import base64
import html
from pathlib import Path

HERE = Path(__file__).parent
SHOTS = HERE / "shots"
ROUTE = "http://localhost:3121/prototype/auth"

# (shot name, title, route query, notes, questions). A question is plain text; numbering runs across the page.
SECTIONS = [
    ("01-sign-in", "Sign in", "screen=sign-in",
     "Today's look kept: the split layout with the picture from lg up, the white Google button, amber primary. "
     "Changes: one label, Continue with Google, on sign-in and sign-up; Forgot password? sits beside the Password label; "
     "an eye shows the password; Remember me becomes Stay signed in on this device, checked.",
     ["Keep the split layout with the picture for all account pages (as shown), or move to a centred card without the picture?",
      "Keep \"Stay signed in on this device\" (checked by default; unchecked, the session ends when the browser closes), or drop it and always stay signed in? Today's Remember me does nothing.",
      "One label, \"Continue with Google\", on both sign-in and sign-up (today: \"Sign in with Google\" / \"Sign up with Google\"). Agreed?"]),
    ("02-sign-in-error", "Sign in: wrong email or password", "screen=sign-in&state=error",
     "Both fields turn red and the message links to the password reset. It never says which of the two was wrong.",
     ["The error never reveals whether an account exists for the email. Agreed, even though it is less helpful to someone who mistyped their address?"]),
    ("03-sign-in-unverified", "Sign in: email not confirmed yet", "screen=sign-in&state=unverified",
     "For a member who signed up with email and never opened the confirmation link. Also in the prototype: state=throttled, after too many tries.",
     ["Keep requiring a confirmed email before the first sign-in, as Supabase does today? The alternative lets new members in at once and asks them to confirm later with a banner."]),
    ("04-sign-up", "Sign up", "screen=sign-up",
     "The length rule ticks green while typing; Create account stays grey until it is met. No repeat-password field: the eye replaces it.",
     ["Password minimum: today the sign-up form demands 10 characters while its hint says 6, and the reset page accepts 6. The prototype uses 10 everywhere. Keep 10, or 8 (Better Auth's default)?",
      "No \"repeat password\" field, only the eye to check it. Agreed?",
      "The fine print names only the Privacy Policy, because the site has no Terms page. Is that enough, or should there be terms to agree to?"]),
    ("05-sign-up-guest", "Sign up with guest data in this browser", "screen=sign-up&state=guest",
     "A guest who rated titles before signing up sees what comes along. Today the transfer happens silently after sign-in.",
     ["Show the guest's counts (\"Your 12 ratings and 4 Wishlist titles come along\") on the sign-up page?"]),
    ("06-sign-up-taken", "Sign up with an email that already has an account", "screen=sign-up&state=taken",
     "The friendly version: it says so and offers Sign in and set a new password.",
     ["Email already registered: say so (shown; friendly, but it tells anyone that the address has an account), or always answer \"check your inbox\" and email the owner \"someone tried to sign up with your address; sign in or set a new password\"?"]),
    ("07-verify-sent", "Email verification: check your inbox", "screen=verify&state=sent",
     "Names the address and the sender, explains the other-device case of the guest transfer, and counts down before Resend (one new link a minute).",
     ["Sender: GoodWatch <hello@goodwatch.app>? (The Purelymail mailbox's address.)",
      "Confirmation links last 24 hours and only the newest one works. Agreed?"]),
    ("08-verify-confirmed", "Email verification: confirmed", "screen=verify&state=confirmed",
     "The link signs the member in and continues to where sign-up started (the taste quiz by default, as today).",
     ["Sign the member in when they open the confirmation link, also on another device than the one they signed up on?"]),
    ("09-verify-expired", "Email verification: link expired", "screen=verify&state=expired",
     "The address is filled in; one press sends a new link.", []),
    ("10-forgot", "Password reset: ask for a link", "screen=forgot", "", []),
    ("11-forgot-sent", "Password reset: link sent", "screen=forgot&state=sent",
     "Says \"if there's an account\", so it reveals nothing, and reminds Google members that they have no password.",
     ["A member who only ever used Google asks for a reset: send nothing (shown: the page tells them to use Google), send a \"you sign in with Google\" email, or send a real reset link that adds a password to their account?"]),
    ("12-reset", "Password reset: set a new password", "screen=reset",
     "One field with the eye and the length rule. Sign out on all other devices is checked.",
     ["\"Sign out on all other devices\" checked by default, while connected apps such as Claude keep working. Or should a new password also disconnect the apps?"]),
    ("13-reset-done", "Password reset: saved", "screen=reset&state=done",
     "The member is signed in on this device straight away.",
     ["After a new password, sign the member in directly (shown), or send them to the sign-in page to type it once?"]),
    ("14-reset-expired", "Password reset: link expired or used", "screen=reset&state=expired",
     "Reset links work for one hour and once.", []),
    ("15-emails", "The two emails", "screen=emails",
     "Both are short, branded, with one button and the plain address below it. Light background so they read well in every mail app.",
     ["Is this the look and wording for the confirmation and reset emails?",
      "Also send a \"your password was changed\" email after every reset or change? It warns a member whose account was taken over, and costs one email of the daily Purelymail budget each."]),
    ("16-notice-A-banner", "Sign in again, variant A: a banner on the page they opened", "screen=notice&variant=A",
     "Shows once, in a browser that still holds the old Supabase cookie, on whatever page the member opened. Sign in goes to the sign-in page below; the cross dismisses it.",
     ["Variant A (a banner, then the sign-in page) or variant B (a dialog with the sign-in inside it)?",
      "Wording: \"GoodWatch has a new sign-in, so you were signed out once. Everything you saved is still here.\" Say why (for example \"so you can connect apps like Claude\"), or keep it this short?",
      "Once dismissed (or \"Not now\" in B) it is gone for good, because showing it clears the old cookie. Or keep showing it on each visit until the member signs in?"]),
    ("17-notice-A-sign-in", "Sign in again, variant A: the sign-in page it leads to", "screen=sign-in&state=cutover",
     "The heading reads Sign in again and a note explains the move. Same form as always.", []),
    ("18-notice-B-dialog", "Sign in again, variant B: a dialog with the sign-in inside", "screen=notice&variant=B",
     "The dialog covers the page (a sheet from the bottom on phones). Signing in here keeps the member on the page they opened.", []),
    ("19-sign-in-connect", "Signing in on the way to connecting an app", "screen=sign-in&state=connect&client=claude",
     "A signed-out member who adds GoodWatch in Claude lands here first. A strip names the app, and the picture column shows the connection instead of the slogan. Create an account carries the same context.",
     ["While an app waits, the picture column says \"Connect Claude\" instead of the usual slogan. Agreed?"]),
    ("20-consent-A-claude", "Consent, variant A: a card inside the site", "screen=consent&variant=A&client=claude",
     "The site's header stays. Lists what the app can see, what it can change and what it can never do; Allow names the app. Everything the connector offers is granted at once.",
     ["Variant A (a card inside the site, header and dock visible) or variant B (a page of its own, no navigation to wander off from the app's flow)?",
      "Do the three lists say the right things? \"Can see\": ratings, Wishlist, Not interested, watches and show progress, taste and recommendations, country and services. \"Can change\": log and undo watches, rate, Not interested, Wishlist, show status, country and services. \"Never\": email, password, account deletion, other apps. Search and title information are public and not listed."]),
    ("21-consent-B-claude", "Consent, variant B: a page of its own, with an access choice", "screen=consent&variant=B&client=claude",
     "No site navigation. The member picks See and change (selected) or See only.",
     ["Offer the choice between \"See and change\" and \"See only\" (two scopes; read tools only with See only), or always grant everything the connector offers? The choice can go with either layout."]),
    ("22-consent-B-see-only", "Consent, variant B: See only picked", "screen=consent&variant=B&client=chatgpt",
     "The change list greys out and its title says it can't change anything.", []),
    ("23-consent-A-unverified", "Consent for an app GoodWatch can't verify", "screen=consent&variant=A&client=unknown",
     "Apps that publish their details at their own address (CIMD: Claude, ChatGPT) show their maker and domain with a green shield. An app that registered itself (DCR) gets this warning; its name is its own claim.",
     ["Accept self-registered apps (DCR) at all, with this warning? Accepting them lets clients without CIMD connect (some editors and CLIs); refusing them leaves Claude, ChatGPT and Claude Code."]),
    ("24-consent-allowed", "After Allow", "screen=consent&variant=A&state=allowed&client=claude",
     "The browser goes straight back to the app; this is the moment in between. Deny looks the same with \"was not connected\".", []),
    ("25-apps-A", "Connected apps, variant A: a tab of its own in Settings", "screen=apps&variant=A",
     "Each app with its access, when it was connected and last used, and Disconnect. Below: the connector address to copy and a link to step-by-step help.",
     ["Variant A (its own Connected apps tab) or variant B (a section at the end of the Account tab)?",
      "Show \"Last used\"? It needs a timestamp written on token use (throttled, for example once an hour per app).",
      "Put the connector address and \"Step-by-step for Claude and ChatGPT\" here? The help page itself is not in this prototype; it is also what a connector listing needs."]),
    ("26-apps-A-confirm", "Connected apps: Disconnect asks once", "screen=apps&variant=A&state=confirm",
     "Inline confirmation in the row, no dialog. After Disconnect the row goes and a green line says how to reconnect.",
     ["Claude Code shows one row per computer (each registers on its own). Show them like this, one row each with \"On a computer\", or group them under one Claude Code row?"]),
    ("27-apps-B", "Connected apps, variant B: a section in Account", "screen=apps&variant=B",
     "The Account tab also lists the sign-in methods (Google, email). Change password and Restart onboarding stay as today and are folded away here.", []),
    ("28-apps-empty", "Connected apps: none yet", "screen=apps&variant=A&state=empty",
     "Says what connecting is good for, and shows the address.", []),
]


def img(name: str) -> str:
    data = base64.b64encode((SHOTS / f"{name}.webp").read_bytes()).decode()
    return f"data:image/webp;base64,{data}"


def build() -> str:
    parts = []
    toc = []
    number = 0
    for name, title, query, notes, questions in SECTIONS:
        anchor = name
        first = number + 1
        items = []
        for question in questions:
            number += 1
            items.append(f'<li value="{number}">{html.escape(question)}</li>')
        qs = f'<ol class="questions">{"".join(items)}</ol>' if items else ""
        badge = f'<span class="qcount">Q{first}–{number}</span>' if len(items) > 1 else (f'<span class="qcount">Q{first}</span>' if items else "")
        toc.append(f'<li><a href="#{anchor}">{html.escape(title)}</a> {badge}</li>')
        parts.append(f"""
<section id="{anchor}">
  <h2>{html.escape(title)}</h2>
  <p class="route"><code>{ROUTE}?{html.escape(query)}</code></p>
  {f'<p class="notes">{html.escape(notes)}</p>' if notes else ''}
  <div class="pair">
    <figure class="desktop"><img loading="lazy" src="{img(name + '-desktop')}" alt="{html.escape(title)}, desktop"><figcaption>Desktop, 1440 wide</figcaption></figure>
    <figure class="phone"><img loading="lazy" src="{img(name + '-phone')}" alt="{html.escape(title)}, phone"><figcaption>Phone, 390 wide</figcaption></figure>
  </div>
  {qs}
</section>""")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Account Pages Review</title>
<style>
:root {{ --bg:#0f1420; --panel:#161c2b; --line:#2a3245; --text:#e6e8ee; --muted:#9aa3b5; --accent:#f59e0b; --q:#2a2111; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--text); font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; }}
main {{ max-width:1200px; margin:0 auto; padding:32px 16px 96px; }}
h1 {{ font-size:2rem; margin:0 0 8px; }}
h2 {{ font-size:1.35rem; margin:0 0 4px; }}
a {{ color:var(--accent); }}
.lead {{ color:var(--muted); max-width:70ch; }}
.toc {{ columns:2 22rem; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px 16px 16px 36px; margin:24px 0 40px; }}
.toc li {{ break-inside:avoid; margin:2px 0; }}
.qcount {{ font-size:.75rem; color:var(--accent); border:1px solid #6b4a10; border-radius:999px; padding:0 6px; margin-left:4px; }}
section {{ border-top:1px solid var(--line); padding:32px 0; }}
.route code {{ font-size:.8rem; color:var(--muted); word-break:break-all; }}
.notes {{ max-width:75ch; color:#c9cfdb; }}
.pair {{ display:grid; grid-template-columns:minmax(0,3fr) minmax(0,1fr); gap:16px; align-items:start; margin:16px 0; }}
figure {{ margin:0; }}
figure img {{ width:100%; height:auto; display:block; border:1px solid var(--line); border-radius:8px; background:#000; }}
figure.phone img {{ max-height:900px; object-fit:cover; object-position:top; }}
figure.phone img.open {{ max-height:none; }}
figcaption {{ font-size:.8rem; color:var(--muted); margin-top:4px; }}
.questions {{ background:var(--q); border:1px solid #6b4a10; border-radius:12px; padding:16px 16px 16px 48px; margin:16px 0 0; }}
.questions li {{ margin:6px 0; padding-left:4px; }}
.questions li::marker {{ color:var(--accent); font-weight:700; }}
@media (max-width:700px) {{ .pair {{ grid-template-columns:1fr; }} figure.phone {{ max-width:360px; }} }}
</style>
</head>
<body>
<main>
<h1>Account pages prototype</h1>
<p class="lead">Issue <a href="https://github.com/alp82/goodwatch-monorepo/issues/534">#534</a>: sign-in, sign-up, email verification, password reset, the one-time "please sign in again" notice for the move away from Supabase, the consent page an app such as Claude opens, and Connected apps in Settings. Everything is made up: no sign-in service is called. Screens are clickable on the prototype route; each section names its address. The site's header shows "Sign in" everywhere because the prototype has no real session. Open questions are numbered right under the screenshots they are about ({number} in all). Tall phone shots are cut at 900 px: click one to see it whole.</p>
<ol class="toc">{''.join(toc)}</ol>
{''.join(parts)}
</main>
<script>document.querySelectorAll("figure.phone img").forEach(i => i.addEventListener("click", () => i.classList.toggle("open")))</script>
</body>
</html>
"""


if __name__ == "__main__":
    out = HERE / "review.html"
    out.write_text(build())
    print(out, out.stat().st_size)
