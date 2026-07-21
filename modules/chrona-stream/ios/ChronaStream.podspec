Pod::Spec.new do |s|
  s.name           = 'ChronaStream'
  s.version        = '1.0.0'
  s.summary        = 'Native bridge for streaming activity events from Chrona Helper over Bonjour/TCP'
  s.description    = 'Discovers the Chrona Helper macOS app via Bonjour, maintains a TCP connection, and forwards app-activity, idle, and heartbeat events to the Chrona React Native app.'
  s.author         = 'Chrona'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
