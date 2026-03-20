self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || "Tasman Star Seafoods";
  const options = {
    body: data.body || "You have a new message!",
    icon: "/images/logo.png",
    badge: "/images/logo.png",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      if (windowClients.length > 0) {
        windowClients[0].focus();
        return windowClients[0].navigate(urlToOpen);
      }
      // Otherwise, open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});
