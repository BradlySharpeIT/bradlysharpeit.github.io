<?php
/*
  error_reporting(~0);
  ini_set('display_errors', 1);
*/
  $sent = 0;

  if(isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $_SERVER['REMOTE_ADDR'] = $_SERVER['HTTP_X_FORWARDED_FOR'];
  }

  $ajax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest';

  $filePath = 'recaptchalib.php';

  require_once($filePath);

  $siteKey = "6LdN5xATAAAAAAuu4WoiGNseXMsM8r9XNhITB04M";
  $secret = "6LdN5xATAAAAAODSkngdesKP9u3RVyD1Gw7VNa_k";

  // The response from reCAPTCHA
  $resp = null;
  $errors = array();
  $fields = array(
    'email'     => array('required' => true),
    'reason'    => array('required' => true),
    'fullname'  => array('required' => true),
    'phone'     => array(),
    'message'   => array('required' => true)
  );
  $data = array();
  $valid = true;

  $reCaptcha = new ReCaptcha($secret);
  // Was there a reCAPTCHA response?
  if ($_POST["g-recaptcha-response"]) {
      $resp = $reCaptcha->verifyResponse(
          $_SERVER["REMOTE_ADDR"],
          $_POST["g-recaptcha-response"]
      );
      if ($resp == null || !$resp->success) {
        $valid = false;
        $errors['g-recaptcha-response'] = ($resp != null) ? $resp->errorCodes : array('no-recaptcha-response');
      };
  } else {
    $valid = false;
    // echo "<br />Captcha Failed: " . $resp->errorCodes . "<br />";
    $errors['g-recaptcha-response'] = array('required-field-missing');
  }

  foreach ($fields as $field => $spec) {
    if (isset($spec['required']) && $spec['required']) {
      if (!array_key_exists($field, $_POST) || empty($_POST[$field])) {
        $valid = false;
        if (!isset($errors[$field])) {
          $errors[$field] = array();
        }

        array_push($errors[$field], 'required-field-missing');
      }
    }

    $data[$field] = "";
    if (array_key_exists($field, $_POST) && !empty($_POST[$field])) {
      $str = mb_convert_encoding($_POST[$field], 'UTF-8', 'UTF-8');
      $str = htmlentities($str, ENT_QUOTES, 'UTF-8');
      $data[$field] = strip_tags($str);
    }
  }

  if ($valid) {
    $to = "Contact Form - Fluent Development <fluent@fluentdevelopment.com.au>";
    $reason = implode(" ", explode("-", $data['reason']));
    $subject = "Contact Form - " . ucfirst($reason);
    $boundary = uniqid('np');

    $headers  = "MIME-Version: 1.0\n";
    $headers .= "Sender: " . "internal@fluentdevelopment.com.au" . "\n";
    $headers .= "Reply-To: " . $data['fullname']. " <" . $data['email'] . ">" . "\n";
    // Hack to resolve issue with DMARC - https://en.wikipedia.org/wiki/DMARC
    $headers .= "From: " . $data['fullname'] . " <" . $data['email'] . ".INVALID" . ">" . "\n";
    $headers .= "Content-Type: multipart/alternative;boundary=" . $boundary . "\n";
    //$headers .= "CC: susan@example.com\n";

    //Plain text body
    $message  = "From: " . $data['fullname'] . "\r\n";
    $message .= "Email: " . $data['email'] . "\r\n";
    $message .= "Phone: " . $data['phone'] . "\r\n";
    $message .= "Reason: " . $data['reason'] . "\r\n";
    $message .= "Message: " . "\r\n" . "\r\n" . $data['message'];
    $message .= "\r\n\r\n--" . $boundary . "\r\n";
    $message .= "Content-type: text/html;charset=utf-8\r\n\r\n";

    //Html body
    $message .= "<html>
  <body style='color:#333;'><h1>Contact Form Submission</h1>
    <table rules=\"all\" style=\"border: 1px solid #666;\" border=\"1\" cellpadding=\"10\" cellspacing=\"0\">
      <tr style=\"background: #eee;\">
        <td><strong>Name:</strong></td><td>" . $data['fullname'] . "</td>
      </tr>
      <tr>
        <td><strong>Email:</strong></td><td>" . $data['email'] . "</td>
      </tr>
      <tr style=\"background: #eee;\">
        <td><strong>Phone:</strong></td><td>" . $data['phone'] . "</td>
      </tr>
      <tr>
        <td><strong>Reason:</strong></td><td>" . $reason . "</td>
      </tr>
    </table><br /><br />
    <strong>Message:</strong><br /><br />
    " . $data['message'] . "
  </body>
</html>";
    $message .= "\r\n\r\n--" . $boundary . "--";

    $sent = mail($to, $subject, $message, $headers, "-f" . "internal@fluentdevelopment.com.au");
  }

  $response = array();
  $response['sent'] = $sent;
  $response['captcha_response'] = $resp;
  $response['errors'] = $errors;
  $response['safemode'] = ini_get('safe_mode');
  $response['errors'] = $errors;

  if ($ajax) {
    # Convert errors to an object
    $response['errors'] = (object)$response['errors'];
    echo json_encode($response);
  } else {
    $success_url = isset($_POST["success_url"]) ? $_POST["success_url"] : './thankyou/';
    $failure_url = isset($_POST["failure_url"])
      ? $_POST["failure_url"]
      : isset($_SERVER['HTTP_REFERER'])
        ? $_SERVER['HTTP_REFERER']
        : implode('/', array_slice(explode($_SERVER['REQUEST_URI'], '/'), 0, -1)) . '/';

    $redirect_url = $success_url;
    if (!$sent) {
      $response = array_merge($data, $response);
      $query = http_build_query($response);
      $redirect_url = $failure_url . (strpos($failure_url, '#') === false ? '#' : '&') . $query;
    }

    header('Location: ' . $redirect_url);
  }

?>
