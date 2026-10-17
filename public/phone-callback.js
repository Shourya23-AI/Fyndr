// Return page for phone.email (moved out of phone-callback.html so the page can forbid inline script).
// phone.email sends the popup/tab back here with ?access_token=… (some setups use the #fragment).
// 1) Popup flow: hand the token to the Fyndr tab that opened us, then close.
// 2) Same-tab flow (phones, blocked popups): go back to Fyndr carrying the token in the link, so nothing depends on storage.
const message = document.getElementById("m");
const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
const pick = (k) => params.get(k) || hashParams.get(k) || "";
const token = pick("access_token") || pick("token") || pick("user_json_url");
const failure = pick("error") || pick("error_description");
const back = document.getElementById("back");

function show(text, link) {
  message.textContent = text;
  if (link) {
    document.getElementById("b").hidden = false;
  }
}

function backToApp() {
  const target = "index.html#/phone?token=" + encodeURIComponent(token);
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.setItem("fyndr-phone-token", token);
    } catch {} // storage can be blocked by privacy settings
  }
  back.href = target;
  show("Taking you back to Fyndr…", true);
  location.replace(target);
}

if (!token) {
  show(failure ? "Verification failed: " + failure : "Verification was not completed.", true);
} else {
  const payload = { type: "fyndr-phone-token", token };
  history.replaceState(null, "", location.pathname); // keep the token out of the address bar

  let channel = null;
  try {
    channel = new BroadcastChannel("fyndr-phone");
  } catch {}

  let received = false;
  if (channel) {
    channel.onmessage = (e) => {
      if (e.data && e.data.type === "fyndr-phone-ack") {
        received = true;
      }
    };
    channel.postMessage(payload);
  }
  try {
    window.opener && window.opener.postMessage(payload, location.origin);
  } catch {}

  const handedOver = () => {
    show("Phone number received. You can close this window.", true);
    setTimeout(() => window.close(), 600);
  };

  if (!channel) {
    // Very old browser: nothing to wait for, rely on the opener message.
    window.opener ? handedOver() : backToApp();
  } else {
    setTimeout(() => (received ? handedOver() : backToApp()), 900);
  }
}
