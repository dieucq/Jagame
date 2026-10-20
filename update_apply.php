<?php
/**
 * update_apply.php — bước "đổi mã" của Cập nhật 1 nút (RB-03, Docs/OPS/QUY-TRINH.md mục 5.4). CHẠY ĐỘC LẬP (không CodeIgniter), bằng PHP CLI
 * của gói, do SCRIPT GIÁM SÁT gọi khi PHP + Node ĐÃ DỪNG (run_mac.sh / run_window.ps1 — tiến trình cha, nhận mã thoát 75 của con).
 *
 *   php update/apply.php apply    <gốc>          làm phần việc đang chờ trong update/state.json: ready|applying -> đổi mã theo update/plan.json;
 *                                                revert -> quay về bản prev (nút "Quay lại bản trước"). Xong -> phase verifying. Không có việc -> in NONE.
 *   php update/apply.php check    <gốc> [cổng]   1 lần gõ http://127.0.0.1:<cổng>/health?update=<nonce> (bản mới tự kiểm schema + phiên bản):
 *                                                đạt -> phase done (mã 0); chưa/không đạt -> mã 3.
 *   php update/apply.php rollback <gốc> [lý do]  bản mới không lên -> trả mã cũ từ update/prev-<bản cũ>/, phase rolled_back.
 *   php update/apply.php phase    <gốc>          in phase hiện tại (rỗng nếu không có).
 *
 * Bản chạy là update/apply.php = bản sao update_apply.php của BẢN ĐANG CHẠY lúc bấm cập nhật (mã cũ, đã biết chạy được), không phải của gói mới.
 * Mọi bước LÀM LẠI ĐƯỢC (mất điện giữa chừng -> lần chạy sau làm tiếp): mỗi mục chỉ đổi tên (cùng ổ, nguyên tử), trạng thái suy ra từ đĩa.
 * Chỉ đụng các mục ghi trong plan.json, và mục nào cũng phải qua danh sách CHO PHÉP ở dưới (kiểm lại ở đây, không tin plan mù quáng).
 */
if (PHP_SAPI !== 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) {
	http_response_code(404);   // không bao giờ chạy qua web (router.php cũng chặn); Selfupdate.php chỉ nạp lớp ở dưới
	exit;
}

if (!class_exists('JgUpdateApply', FALSE)) {
final class JgUpdateApply
{
	const DIRS = array('application', 'system', 'assets', 'Realtime');
	const FILES = array('index.php', 'router.php', '.htaccess', 'update_apply.php', 'update.json');
	// Tệp script/hướng dẫn ở gốc gói (run_mac.sh, run_window.ps1, keepalive_mac.sh, HUONG-DAN-CAI-DAT.txt, Jagame.command…).
	const FILE_RE = '/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.(sh|ps1|bat|command|txt|md)$/';
	// .bat đang chạy (cmd đọc tệp .bat theo vị trí byte từng dòng) -> không bao giờ thay khi đang chạy: giữ nguyên bản đang có.
	const NEVER = array('run_window.bat', 'keepalive_win.bat');

	public $root;
	public $up;

	public function __construct($root)
	{
		$this->root = rtrim(str_replace('\\', '/', (string) $root), '/');
		$this->up = $this->root . '/update';
	}

	/** Tên mục gốc được phép đổi (danh sách CHO PHÉP; dữ liệu database/ uploads/ games/ cloudflared/ runtime/ php/ update/ không bao giờ khớp). */
	public static function allowed($name)
	{
		$name = (string) $name;
		if (in_array($name, self::NEVER, TRUE)) {
			return FALSE;
		}
		return in_array($name, self::DIRS, TRUE) || in_array($name, self::FILES, TRUE) || preg_match(self::FILE_RE, $name) === 1;
	}

	public function read($f)
	{
		$j = is_file($f) ? json_decode((string) @file_get_contents($f), TRUE) : NULL;
		return is_array($j) ? $j : NULL;
	}

	public function write($f, array $data)
	{
		$tmp = $f . '.' . getmypid() . '.tmp';
		if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) === FALSE) {
			return FALSE;
		}
		if (!@rename($tmp, $f)) {   // Windows cũ: rename đè có thể lỗi khi tệp đích đang mở -> xóa rồi đổi
			@unlink($f);
			return @rename($tmp, $f);
		}
		return TRUE;
	}

	public function state()
	{
		return $this->read($this->up . '/state.json') ?: array();
	}

	public function set_state(array $patch)
	{
		$st = array_merge($this->state(), $patch, array('at' => time()));
		$this->write($this->up . '/state.json', $st);
		return $st;
	}

	public function log($msg)
	{
		@file_put_contents($this->up . '/apply.log', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND);
	}

	/** Đổi tên có thử lại (Windows: phần mềm diệt virus / chỉ mục giữ tệp vài trăm ms). */
	public static function mv($from, $to)
	{
		for ($i = 0; $i < 20; $i++) {
			if (@rename($from, $to)) {
				return TRUE;
			}
			clearstatcache();
			if (!file_exists($from) && file_exists($to)) {
				return TRUE;
			}
			usleep(250000);
		}
		return FALSE;
	}

	private static function exists($p)
	{
		clearstatcache();
		return file_exists($p) || is_link($p);
	}

	/** Danh sách mục của plan, đã lọc lại theo danh sách cho phép + tên an toàn. */
	public function entries(array $plan)
	{
		$out = array();
		foreach ((array) ($plan['entries'] ?? array()) as $n) {
			$n = (string) $n;
			if ($n !== '' && strpbrk($n, "/\\:\0") === FALSE && $n !== '.' && $n !== '..' && self::allowed($n)) {
				$out[] = $n;
			}
		}
		return array_values(array_unique($out));
	}

	public static function ver_ok($v)
	{
		return preg_match('/^\d{1,4}\.\d{1,4}\.\d{1,4}(-[0-9A-Za-z]{1,20}(\.[0-9A-Za-z]{1,20}){0,3})?$/', (string) $v) === 1;   // = Updatecheck::VER_RE
	}

	/**
	 * Đổi mã: mỗi mục — bản đang chạy -> update/prev-<from>/<mục>, update/staging/<mục> -> gốc. Làm lại được: mục đã chuyển thì bỏ qua.
	 * Lỗi giữa chừng -> trả những mục đã đổi về như cũ (rollback_swap) và báo lỗi.
	 */
	public function apply_swap(array $plan)
	{
		$from = (string) ($plan['from'] ?? '');
		if (!self::ver_ok($from) || !self::ver_ok((string) ($plan['to'] ?? ''))) {
			return 'plan: phiên bản không hợp lệ';
		}
		$stage = $this->up . '/staging';
		$prev = $this->up . '/prev-' . $from;
		if (!is_dir($prev) && !@mkdir($prev, 0755, TRUE)) {
			return 'không tạo được ' . $prev;
		}
		foreach ($this->entries($plan) as $n) {
			$cur = $this->root . '/' . $n;
			$new = $stage . '/' . $n;
			$old = $prev . '/' . $n;
			if (!self::exists($new) && !self::exists($old) && self::exists($cur)) {
				// Mục chỉ có ở bản cũ (bản mới bỏ): cất vào prev để quay lại được.
				if (!self::mv($cur, $old)) {
					return 'không chuyển được ' . $n . ' vào prev';
				}
				continue;
			}
			if (!self::exists($new)) {
				continue;   // đã đổi xong ở lần chạy trước (hoặc bản mới không có mục này)
			}
			if (self::exists($cur)) {
				if (self::exists($old)) {
					return 'đụng độ: ' . $n . ' có ở cả gốc, staging và prev';
				}
				if (!self::mv($cur, $old)) {
					return 'không chuyển được ' . $n . ' (tệp đang bị giữ?)';
				}
			}
			if (!self::mv($new, $cur)) {
				return 'không đặt được ' . $n . ' của bản mới';
			}
		}
		return NULL;
	}

	/** Trả mã cũ: mục của bản mới (nếu có) -> update/failed-<to>/, prev-<from>/<mục> -> gốc. Làm lại được. */
	public function rollback_swap(array $plan)
	{
		$from = (string) ($plan['from'] ?? '');
		$to = (string) ($plan['to'] ?? '');
		if (!self::ver_ok($from) || !self::ver_ok($to)) {
			return 'plan: phiên bản không hợp lệ';
		}
		$prev = $this->up . '/prev-' . $from;
		$failed = $this->up . '/failed-' . $to . '-' . date('His');
		$err = NULL;
		foreach ($this->entries($plan) as $n) {
			$cur = $this->root . '/' . $n;
			$old = $prev . '/' . $n;
			if (!self::exists($old)) {
				continue;   // mục không có ở bản cũ / đã trả xong — mục MỚI hoàn toàn của bản mới thì cất đi bên dưới
			}
			if (self::exists($cur)) {
				if (!is_dir($failed)) {
					@mkdir($failed, 0755, TRUE);
				}
				if (!self::mv($cur, $failed . '/' . $n)) {
					$err = 'không gỡ được ' . $n . ' của bản mới';
					continue;
				}
			}
			if (!self::mv($old, $cur)) {
				$err = 'không trả được ' . $n . ' của bản cũ';
			}
		}
		// Mục chỉ bản mới có (bản cũ không có) -> cất đi để gốc giống hệt bản cũ.
		foreach ($this->entries($plan) as $n) {
			$cur = $this->root . '/' . $n;
			if (in_array($n, (array) ($plan['added'] ?? array()), TRUE) && self::exists($cur)) {
				if (!is_dir($failed)) {
					@mkdir($failed, 0755, TRUE);
				}
				self::mv($cur, $failed . '/' . $n);
			}
		}
		return $err;
	}

	public function cmd_apply()
	{
		$st = $this->state();
		$phase = (string) ($st['phase'] ?? '');
		$plan = $this->read($this->up . '/plan.json');
		if (!in_array($phase, array('ready', 'applying', 'revert'), TRUE) || !$plan) {
			echo "NONE\n";
			return 0;
		}
		if ($phase === 'revert') {
			$this->log('quay lại bản ' . $plan['from'] . ' theo yêu cầu (đang chạy ' . $plan['to'] . ')');
			$err = $this->rollback_swap($plan);
			if ($err !== NULL) {
				$this->log('LỖI quay lại: ' . $err);
				$this->set_state(array('phase' => 'failed', 'error' => $err));
				echo 'FAIL ' . $err . "\n";
				return 1;
			}
			// Sau khi quay lại: bản đang chạy = from. Kiểm như 1 lần cập nhật (from <-> to đổi chỗ, không có prev để quay tiếp).
			$this->write($this->up . '/plan.json', array_merge($plan, array('from' => $plan['to'], 'to' => $plan['from'], 'reverted' => TRUE)));
			$this->set_state(array('phase' => 'verifying', 'verify_from' => time(), 'reverted' => TRUE, 'to' => $plan['from'], 'from' => $plan['to']));
			echo "OK\n";
			return 0;
		}
		$this->set_state(array('phase' => 'applying'));
		$this->log('đổi mã ' . $plan['from'] . ' -> ' . $plan['to'] . ': ' . implode(' ', $this->entries($plan)));
		$err = $this->apply_swap($plan);
		if ($err !== NULL) {
			$this->log('LỖI đổi mã: ' . $err . ' — trả lại mã cũ');
			$rb = $this->rollback_swap($plan);
			$this->set_state(array('phase' => 'rolled_back', 'error' => $err . ($rb !== NULL ? ' | quay lại: ' . $rb : ''), 'stage_error' => TRUE));
			echo 'FAIL ' . $err . "\n";
			return 1;
		}
		$this->set_state(array('phase' => 'verifying', 'verify_from' => time()));
		echo "OK\n";
		return 0;
	}

	public function cmd_check($port)
	{
		$st = $this->state();
		$plan = $this->read($this->up . '/plan.json');
		if (($st['phase'] ?? '') !== 'verifying' || !$plan) {
			return ($st['phase'] ?? '') === 'done' ? 0 : 3;
		}
		$port = (int) $port ?: (int) trim((string) @file_get_contents($this->root . '/database/.app_port'));
		if ($port < 1 || $port > 65535) {
			return 3;
		}
		$url = 'http://127.0.0.1:' . $port . '/health?update=' . rawurlencode((string) ($plan['nonce'] ?? ''));
		$ctx = stream_context_create(array('http' => array('timeout' => 4, 'ignore_errors' => TRUE, 'header' => "Connection: close\r\n")));
		$body = @file_get_contents($url, FALSE, $ctx);
		$code = 0;
		foreach ((array) ($http_response_header ?? array()) as $h) {
			if (preg_match('~^HTTP/\S+\s+(\d{3})~', $h, $m)) {
				$code = (int) $m[1];
			}
		}
		$j = is_string($body) ? json_decode($body, TRUE) : NULL;
		if ($code === 200 && is_array($j) && !empty($j['ok']) && ($j['update'] ?? '') === 'ok' && ($j['version'] ?? '') === (string) $plan['to']) {
			$this->set_state(array('phase' => 'done', 'done_at' => time(), 'error' => NULL));
			$this->log('bản ' . $plan['to'] . ' đã chạy: /health + schema đạt');
			return 0;
		}
		$why = $code === 0 ? 'chưa trả lời' : ('HTTP ' . $code . (is_array($j) && isset($j['error']) ? ' ' . substr((string) $j['error'], 0, 160) : ''));
		$this->set_state(array('last_check' => $why));
		return 3;
	}

	/** Mã lý do của script giám sát -> câu cho chủ nhà (không chữ kỹ thuật kiểu "/health"). */
	public static function why_text($why)
	{
		$why = (string) $why;
		if (preg_match('/^exit:(-?\d{1,5})$/', $why, $m)) {
			return 'bản mới dừng ngay khi chạy (mã ' . $m[1] . ')';
		}
		if ($why === 'timeout') {
			return 'bản mới không trả lời sau 90 giây';
		}
		return mb_substr(preg_replace('/[\x00-\x1f]/', ' ', $why), 0, 120);
	}

	public function cmd_rollback($why)
	{
		$why = self::why_text($why);
		$st = $this->state();
		$plan = $this->read($this->up . '/plan.json');
		if (!$plan || !in_array((string) ($st['phase'] ?? ''), array('verifying', 'applying'), TRUE)) {
			echo "NONE\n";
			return 0;
		}
		if (!empty($plan['reverted'])) {
			// Đang kiểm bản cũ sau khi chủ nhà bấm "Quay lại": không còn gì để quay tiếp -> chỉ ghi lỗi (không đổi mã nữa, tránh vòng lặp).
			$this->set_state(array('phase' => 'failed', 'error' => 'bản ' . $plan['to'] . ' không lên sau khi quay lại: ' . $why));
			echo "NONE\n";
			return 1;
		}
		$this->log('bản ' . $plan['to'] . ' không lên (' . $why . ') — quay về ' . $plan['from']);
		$err = $this->rollback_swap($plan);
		$this->set_state(array('phase' => $err === NULL ? 'rolled_back' : 'failed', 'error' => $why . ($err !== NULL ? ' | quay lại: ' . $err : '')));
		echo $err === NULL ? "OK\n" : 'FAIL ' . $err . "\n";
		return $err === NULL ? 0 : 1;
	}
}
}

if (PHP_SAPI === 'cli' && realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__) && !defined('JG_UPDATE_APPLY_LIB')) {
	date_default_timezone_set('Asia/Ho_Chi_Minh');   // giờ trong update/apply.log khớp giờ hội quán (run_mac.sh / run_window.ps1 đặt y vậy cho php -S)
	$argv = $_SERVER['argv'];
	$cmd = (string) ($argv[1] ?? '');
	$root = (string) ($argv[2] ?? '');
	if ($root === '' || !is_dir($root) || !is_file($root . '/router.php')) {
		fwrite(STDERR, "update_apply: thiếu thư mục gốc hội quán (có router.php)\n");
		exit(2);
	}
	$a = new JgUpdateApply($root);
	if (!is_dir($a->up)) {
		echo $cmd === 'phase' ? "\n" : "NONE\n";
		exit($cmd === 'check' ? 3 : 0);
	}
	$lock = @fopen($a->up . '/.apply.lock', 'c');
	if ($lock) {
		flock($lock, LOCK_EX);
	}
	switch ($cmd) {
		case 'apply':
			$rc = $a->cmd_apply();
			break;
		case 'check':
			$rc = $a->cmd_check($argv[3] ?? 0);
			break;
		case 'rollback':
			$rc = $a->cmd_rollback((string) ($argv[3] ?? 'không rõ'));
			break;
		case 'phase':
			echo (string) ($a->state()['phase'] ?? ''), "\n";
			$rc = 0;
			break;
		default:
			fwrite(STDERR, "update_apply: lệnh apply|check|rollback|phase\n");
			$rc = 2;
	}
	if ($lock) {
		flock($lock, LOCK_UN);
		fclose($lock);
	}
	exit($rc);
}
