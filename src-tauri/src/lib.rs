#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Configure logging first
  let log_plugin = tauri_plugin_log::Builder::default()
    .level(log::LevelFilter::Debug) // Use Debug level to see detailed HTTP logs
    .build();
  
  tauri::Builder::default()
    // Initialize HTTP plugin
    .plugin(tauri_plugin_http::init())
    // Add logging plugin
    .plugin(log_plugin)
    .setup(|_app| {
      // Set up a listener for HTTP events through environment vars
      std::env::set_var("RUST_LOG", "tauri=debug,tauri_plugin_http=debug");
      
      log::info!("Test-Pilot application started with HTTP logging enabled");
      log::info!("Set RUST_LOG=tauri=debug,tauri_plugin_http=debug for HTTP request logging");
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
