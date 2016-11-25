<?php
/*
    error_reporting(~0);
    ini_set('display_errors', 1);
*/


/**
 * This is a PHP library that handles calling reCAPTCHA.
 *    - Documentation and latest version
 *          https://developers.google.com/recaptcha/docs/php
 *    - Get a reCAPTCHA API Key
 *          https://www.google.com/recaptcha/admin/create
 *    - Discussion group
 *          http://groups.google.com/group/recaptcha
 *
 * @copyright Copyright (c) 2014, Google Inc.
 * @link      http://www.google.com/recaptcha
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * A ReCaptchaResponse is returned from checkAnswer().
 */
class ReCaptchaResponse
{
    public $success;
    public $errorCodes;
}
class ReCaptcha
{
    private static $_signupUrl = "https://www.google.com/recaptcha/admin";
    private static $_siteVerifyUrl =
        "https://www.google.com/recaptcha/api/siteverify?";
    private $_secret;
    /**
     * Constructor.
     *
     * @param string $secret shared secret between site and ReCAPTCHA server.
     */
    function ReCaptcha($secret)
    {
        if ($secret == null || $secret == "") {
            die("To use reCAPTCHA you must get an API key from <a href='"
                . self::$_signupUrl . "'>" . self::$_signupUrl . "</a>");
        }
        $this->_secret=$secret;
    }

    public function verifyResponse($remoteIp, $response) {
        $recaptchaResponse = new ReCaptchaResponse();
        $recaptchaResponse->success = false;
        $recaptchaResponse->errorCodes = 'unknown-error';
        try {
            if ($response == null || strlen($response) == 0) {
                $recaptchaResponse->errorCodes = 'missing-input';
                return $recaptchaResponse;
            }

            $data = [
                'secret'   => $this->_secret,
                'response' => $response,
                'remoteip' => $remoteIp
            ];

            $options = [
                'http' => [
                    'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
                    'method'  => 'POST',
                    'content' => http_build_query($data)
                ]
            ];

            $context  = stream_context_create($options);
            $getResponse = file_get_contents(self::$_siteVerifyUrl, false, $context);

            //$recaptchaResponse->response = $getResponse;
            //$recaptchaResponse->data = $data;

            $answers = json_decode($getResponse, true);
            if (trim($answers ['success']) == true) {
                $recaptchaResponse->success = true;
                $recaptchaResponse->errorCodes = null;
            } else {
                $recaptchaResponse->success = false;
                if (array_key_exists('error-codes', $answers)) {
                    $recaptchaResponse->errorCodes = $answers['error-codes'];
                }
            }
        }
        catch (Exception $e) {
            $recaptchaResponse->success = false;
            $recaptchaResponse->errorCodes = 'internal-server-error';
            $recaptchaResponse->exception = $e;
        }
        return $recaptchaResponse;
    }
}
?>
