# Debug

This is a debug action that can be used to test if the action hub is working.

#### Usage
1. Set `ACTION_HUB_DEBUG_ENDPOINT` to some domain that you control.
2. Run this curl script:

  Substitute in `ACTION_HUB_DOMAIN` and `API_KEY` for the real values.

  You can also play with the `sleep` time.

  ```
  curl -X POST https://ACTION_HUB_DOMAIN/actions/debug/execute -d '{"type":"query", "attachment":{"mimetype": "application/json", "data":"{}"}, "form_params":{"sleep": "1000"}}' -H "Content-Type: application/json" -H 'Authorization: Token token="API_KEY"'
  ```
