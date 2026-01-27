-- Update integrations default settings to include new platforms
UPDATE public.platform_settings 
SET value = '{
  "brightcoveAccountId": "",
  "brightcoveApiKey": "",
  "vimeoAccessToken": "",
  "vimeoClientId": "",
  "vimeoClientSecret": "",
  "awsAccessKeyId": "",
  "awsSecretAccessKey": "",
  "awsS3Bucket": "",
  "awsS3Region": "",
  "activeVideoProvider": "brightcove"
}'::jsonb
WHERE key = 'integrations';