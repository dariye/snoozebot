(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js', {
      scope: '/'
    }).then(function(reg) {
      console.log('Service worker has been registered for scope:'+ reg.scope);
    });
  }
})()


