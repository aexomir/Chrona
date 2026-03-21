Pod::Spec.new do |s|
  s.name           = 'FocusWatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge for Focus'
  s.description    = 'Expo native module that bridges WCSession to React Native'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"

  s.frameworks = 'WatchConnectivity'
end
