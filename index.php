<?php

/*
 *---------------------------------------------------------------
 * APPLICATION ENVIRONMENT
 *---------------------------------------------------------------
 *
 * You can load different configurations depending on your
 * current environment. Setting the environment also influences
 * things like logging and error reporting.
 *
 * This can be set to anything, but default usage is:
 *
 *     development
 *     testing
 *     production
 *
 * NOTE: If you change these, also change the error_reporting() code below
 */
/*############################INSTALL#########################*/

// define('ENVIRONMENT', 'SETUP');

// if (ENVIRONMENT === 'SETUP') {
//     $sitelink = $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
//     $sitelink = preg_replace('/index.php.*/', '', $sitelink); 
//     if (!empty($_SERVER['HTTPS'])) {
//         $sitelink = 'https://' . $sitelink;
//     } else {
//         $sitelink = 'http://' . $sitelink;
//     }
//     header("Location: $sitelink./setup/");
//     exit;
// }

/*############################INSTALL END#########################*/

/*############################REAL#########################*/
define('ENVIRONMENT', isset($_SERVER['CI_ENV']) ? $_SERVER['CI_ENV'] : 'production');
/*############################REAL END#########################*/

// Sản phẩm cho người Việt: php.ini/-d chưa đặt date.timezone (Homebrew/Linux mặc định UTC) -> giờ Việt Nam.
// Dùng get_cfg_var vì từ PHP 8.2 ini_get('date.timezone') luôn trả 'UTC' khi không cấu hình.
$ac_tz = get_cfg_var('date.timezone');
if ($ac_tz === FALSE || trim((string) $ac_tz) === '') {
	date_default_timezone_set('Asia/Ho_Chi_Minh');
}
unset($ac_tz);

// CLI "php index.php cli <lệnh> <tham số…>": tham số (mật khẩu có dấu cách/ký tự đặc biệt) KHÔNG đi qua bộ
// định tuyến URI của CI (permitted_uri_chars sẽ báo "disallowed characters") — cất riêng cho controller Cli.
if (PHP_SAPI === 'cli' && isset($_SERVER['argv'][1]) && $_SERVER['argv'][1] === 'cli' && count($_SERVER['argv']) > 3) {
	define('AC_CLI_ARGS', json_encode(array_slice($_SERVER['argv'], 3)));
	$_SERVER['argv'] = $argv = array_slice($_SERVER['argv'], 0, 3);
	$_SERVER['argc'] = $argc = 3;
}
// "php index.php cli" thiếu tên lệnh: URI "cli" sẽ khớp route link thiệp (/<slug>) và in trang 404 HTML (R3-09)
// -> chuyển sang cli/index để Cli in danh sách lệnh dạng chữ thường.
if (PHP_SAPI === 'cli' && isset($_SERVER['argv'][1]) && $_SERVER['argv'][1] === 'cli' && count($_SERVER['argv']) === 2) {
	$_SERVER['argv'][] = 'index';
	$argv = $_SERVER['argv'];
	$_SERVER['argc'] = $argc = 3;
}

// Mọi cookie (phiên, CSRF, ac_dev…) mang SameSite=Lax: CI 3.1.9 chưa có tùy chọn này, nên thêm vào header
// Set-Cookie ngay trước khi gửi.
if (PHP_SAPI !== 'cli') {
	header_register_callback(function () {
		$cookies = array();
		foreach (headers_list() as $h) {
			if (stripos($h, 'Set-Cookie:') === 0) {
				$cookies[] = $h;
			}
		}
		if (!$cookies) {
			return;
		}
		header_remove('Set-Cookie');
		foreach ($cookies as $h) {
			header(stripos($h, 'samesite=') === FALSE ? $h . '; SameSite=Lax' : $h, FALSE);
		}
	});
}




// S1-SEC-01: POST vượt post_max_size -> PHP bỏ trống $_POST/$_FILES (mất cả token CSRF) -> CI báo 403 "CSRF", trình
// duyệt hiện "Trang đã mở quá lâu" sai bản chất. Kiểm Content-Length NGAY ĐÂY (trước khi CI chạy Security) -> 413 có
// câu rõ: AJAX nhận JSON {ok:false, error, max_mb}, form thường nhận trang HTML. Không in cảnh báo PHP (display_errors
// đã tắt bằng -d/php.ini của launcher; cảnh báo "POST Content-Length exceeds" chỉ vào log).
if (PHP_SAPI !== 'cli' && isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST'
	&& isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 0) {
	$ac_pm = trim((string) ini_get('post_max_size'));
	$ac_unit = strtolower(substr($ac_pm, -1));
	$ac_max = (float) $ac_pm;
	if ($ac_unit === 'g') { $ac_max *= 1073741824; } elseif ($ac_unit === 'm') { $ac_max *= 1048576; } elseif ($ac_unit === 'k') { $ac_max *= 1024; }
	if ($ac_max > 0 && (float) $_SERVER['CONTENT_LENGTH'] > $ac_max) {
		$ac_mb = (int) floor($ac_max / 1048576);
		// Câu chung cho mọi loại tải lên (ảnh, file chat, ảnh vui) — uploader.js tự thay bằng câu "Ảnh…" theo code too_large.
		$ac_vi = 'Tệp quá lớn so với giới hạn máy chủ (tối đa ' . $ac_mb . ' MB)';
		$ac_en = 'File too large for the server limit (max ' . $ac_mb . ' MB)';
		header('HTTP/1.1 413 Payload Too Large', TRUE, 413);
		header('X-Content-Type-Options: nosniff');
		header('Cache-Control: no-store');
		if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
			header('Content-Type: application/json; charset=utf-8');
			echo json_encode(array('ok' => FALSE, 'error' => $ac_vi, 'error_en' => $ac_en, 'code' => 'too_large', 'max_mb' => $ac_mb), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		} else {
			header('Content-Type: text/html; charset=utf-8');
			echo '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'
				. htmlspecialchars($ac_vi, ENT_QUOTES, 'UTF-8') . '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf6f1;color:#3b3030;'
				. 'font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}main{max-width:560px;background:#fff;border:1px solid #eadfd6;border-radius:14px;padding:28px}'
				. 'h1{font:600 1.5rem Georgia,"Times New Roman",serif;margin:0 0 .5rem}a{color:#9a6a73;display:inline-flex;align-items:center;min-height:44px}</style></head>'
				. '<body><main><h1>' . htmlspecialchars($ac_vi, ENT_QUOTES, 'UTF-8') . '</h1><p>Hãy chọn tệp/ảnh nhỏ hơn (hoặc nén bớt) rồi gửi lại. '
				. 'Nếu bạn đang chọn nhiều ảnh, mỗi lần gửi ít ảnh hơn.</p><p lang="en">' . htmlspecialchars($ac_en, ENT_QUOTES, 'UTF-8') . ' — please pick a smaller file and try again.</p>'
				. '<p><a href="javascript:history.back()">← Quay lại</a></p></main></body></html>';
		}
		exit;
	}
	unset($ac_pm, $ac_unit, $ac_max);
}

/*
 *---------------------------------------------------------------
 * ERROR REPORTING
 *---------------------------------------------------------------
 *
 * Different environments will require different levels of error reporting.
 * By default development will show errors but testing and live will hide them.
 */
switch (ENVIRONMENT)
{
	case 'development':
		error_reporting(-1);
		ini_set('display_errors', 1);
	break;

	case 'testing':
	case 'production':
		ini_set('display_errors', 0);
		if (version_compare(PHP_VERSION, '5.3', '>='))
		{
			error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_USER_NOTICE & ~E_USER_DEPRECATED);
		}
		else
		{
			error_reporting(E_ALL & ~E_NOTICE & ~E_USER_NOTICE);
		}
	break;

	default:
		header('HTTP/1.1 503 Service Unavailable.', TRUE, 503);
		echo 'The application environment is not set correctly.';
		exit(1); // EXIT_ERROR
}

/*
 *---------------------------------------------------------------
 * SYSTEM DIRECTORY NAME
 *---------------------------------------------------------------
 *
 * This variable must contain the name of your "system" directory.
 * Set the path if it is not in the same directory as this file.
 */
	$system_path = 'system';

/*
 *---------------------------------------------------------------
 * APPLICATION DIRECTORY NAME
 *---------------------------------------------------------------
 *
 * If you want this front controller to use a different "application"
 * directory than the default one you can set its name here. The directory
 * can also be renamed or relocated anywhere on your server. If you do,
 * use an absolute (full) server path.
 * For more info please see the user guide:
 *
 * https://codeigniter.com/user_guide/general/managing_apps.html
 *
 * NO TRAILING SLASH!
 */
	$application_folder = 'application';

/*
 *---------------------------------------------------------------
 * VIEW DIRECTORY NAME
 *---------------------------------------------------------------
 *
 * If you want to move the view directory out of the application
 * directory, set the path to it here. The directory can be renamed
 * and relocated anywhere on your server. If blank, it will default
 * to the standard location inside your application directory.
 * If you do move this, use an absolute (full) server path.
 *
 * NO TRAILING SLASH!
 */
	$view_folder = '';


/*
 * --------------------------------------------------------------------
 * DEFAULT CONTROLLER
 * --------------------------------------------------------------------
 *
 * Normally you will set your default controller in the routes.php file.
 * You can, however, force a custom routing by hard-coding a
 * specific controller class/function here. For most applications, you
 * WILL NOT set your routing here, but it's an option for those
 * special instances where you might want to override the standard
 * routing in a specific front controller that shares a common CI installation.
 *
 * IMPORTANT: If you set the routing here, NO OTHER controller will be
 * callable. In essence, this preference limits your application to ONE
 * specific controller. Leave the function name blank if you need
 * to call functions dynamically via the URI.
 *
 * Un-comment the $routing array below to use this feature
 */
	// The directory name, relative to the "controllers" directory.  Leave blank
	// if your controller is not in a sub-directory within the "controllers" one
	// $routing['directory'] = '';

	// The controller class file name.  Example:  mycontroller
	// $routing['controller'] = '';

	// The controller function you wish to be called.
	// $routing['function']	= '';


/*
 * -------------------------------------------------------------------
 *  CUSTOM CONFIG VALUES
 * -------------------------------------------------------------------
 *
 * The $assign_to_config array below will be passed dynamically to the
 * config class when initialized. This allows you to set custom config
 * items or override any default config values found in the config.php file.
 * This can be handy as it permits you to share one application between
 * multiple front controller files, with each file containing different
 * config values.
 *
 * Un-comment the $assign_to_config array below to use this feature
 */
	// $assign_to_config['name_of_config_item'] = 'value of config item';



// --------------------------------------------------------------------
// END OF USER CONFIGURABLE SETTINGS.  DO NOT EDIT BELOW THIS LINE
// --------------------------------------------------------------------

/*
 * ---------------------------------------------------------------
 *  Resolve the system path for increased reliability
 * ---------------------------------------------------------------
 */

	// Set the current directory correctly for CLI requests
	if (defined('STDIN'))
	{
		chdir(dirname(__FILE__));
	}

	if (($_temp = realpath($system_path)) !== FALSE)
	{
		$system_path = $_temp.DIRECTORY_SEPARATOR;
	}
	else
	{
		// Ensure there's a trailing slash
		$system_path = strtr(
			rtrim($system_path, '/\\'),
			'/\\',
			DIRECTORY_SEPARATOR.DIRECTORY_SEPARATOR
		).DIRECTORY_SEPARATOR;
	}

	// Is the system path correct?
	if ( ! is_dir($system_path))
	{
		header('HTTP/1.1 503 Service Unavailable.', TRUE, 503);
		echo 'Your system folder path does not appear to be set correctly. Please open the following file and correct this: '.pathinfo(__FILE__, PATHINFO_BASENAME);
		exit(3); // EXIT_CONFIG
	}

/*
 * -------------------------------------------------------------------
 *  Now that we know the path, set the main path constants
 * -------------------------------------------------------------------
 */
	// The name of THIS file
	define('SELF', pathinfo(__FILE__, PATHINFO_BASENAME));

	// Path to the system directory
	define('BASEPATH', $system_path);

	// Path to the front controller (this file) directory
	// Jagame Online (Script/hosted/jg-hosted.js): mã dùng chung 1 bản, mỗi hội quán 1 thư mục gốc riêng (symlink tới mã +
	// database/uploads/games riêng). PHP luôn quy __FILE__ về đường dẫn thật (thư mục mã) nên gốc dữ liệu đến qua env
	// JAGAME_SITE_ROOT. Bản tự host không đặt env -> y như cũ.
	$jg_site_root = getenv('JAGAME_SITE_ROOT');
	define('FCPATH', ($jg_site_root !== FALSE && $jg_site_root !== '' && is_dir($jg_site_root))
		? rtrim($jg_site_root, '/\\').DIRECTORY_SEPARATOR : dirname(__FILE__).DIRECTORY_SEPARATOR);
	unset($jg_site_root);

	// Name of the "system" directory
	define('SYSDIR', basename(BASEPATH));

	define('EXT', '.php'); //for zend framework barcode library. 13-12-2018 by aslarali

	// The path to the "application" directory
	if (is_dir($application_folder))
	{
		if (($_temp = realpath($application_folder)) !== FALSE)
		{
			$application_folder = $_temp;
		}
		else
		{
			$application_folder = strtr(
				rtrim($application_folder, '/\\'),
				'/\\',
				DIRECTORY_SEPARATOR.DIRECTORY_SEPARATOR
			);
		}
	}
	elseif (is_dir(BASEPATH.$application_folder.DIRECTORY_SEPARATOR))
	{
		$application_folder = BASEPATH.strtr(
			trim($application_folder, '/\\'),
			'/\\',
			DIRECTORY_SEPARATOR.DIRECTORY_SEPARATOR
		);
	}
	else
	{
		header('HTTP/1.1 503 Service Unavailable.', TRUE, 503);
		echo 'Your application folder path does not appear to be set correctly. Please open the following file and correct this: '.SELF;
		exit(3); // EXIT_CONFIG
	}

	define('APPPATH', $application_folder.DIRECTORY_SEPARATOR);

	// The path to the "views" directory
	if ( ! isset($view_folder[0]) && is_dir(APPPATH.'views'.DIRECTORY_SEPARATOR))
	{
		$view_folder = APPPATH.'views';
	}
	elseif (is_dir($view_folder))
	{
		if (($_temp = realpath($view_folder)) !== FALSE)
		{
			$view_folder = $_temp;
		}
		else
		{
			$view_folder = strtr(
				rtrim($view_folder, '/\\'),
				'/\\',
				DIRECTORY_SEPARATOR.DIRECTORY_SEPARATOR
			);
		}
	}
	elseif (is_dir(APPPATH.$view_folder.DIRECTORY_SEPARATOR))
	{
		$view_folder = APPPATH.strtr(
			trim($view_folder, '/\\'),
			'/\\',
			DIRECTORY_SEPARATOR.DIRECTORY_SEPARATOR
		);
	}
	else
	{
		header('HTTP/1.1 503 Service Unavailable.', TRUE, 503);
		echo 'Your view folder path does not appear to be set correctly. Please open the following file and correct this: '.SELF;
		exit(3); // EXIT_CONFIG
	}

	define('VIEWPATH', $view_folder.DIRECTORY_SEPARATOR);

/*
 * --------------------------------------------------------------------
 * LOAD THE BOOTSTRAP FILE
 * --------------------------------------------------------------------
 *
 * And away we go...
 */
require_once BASEPATH.'core/CodeIgniter.php';
