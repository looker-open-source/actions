from locust import HttpLocust, TaskSet, task
import os

import json

class ActionHubTaskSet(TaskSet):

    @task
    def get_something(self):
        uri = "/actions/debug/execute"
        data = {
        "type": "query",
            "form_params": {
                "sleep": 0,
                "simulated_download_url": os.getenv('ACTION_HUB_LOAD_TESTING_SIMULATED_DOWNLOAD_URL')
            }
        }

        headers = {}
        headers['Content-Type'] = "application/json"
        headers['User-Agent'] = "looker-actions-load-test/0.1"
        headers['X-Looker-Instance'] = "looker-actions-load-test-simulation"
        headers['X-Looker-Webhook-Id'] = "looker-actions-load-test-simulation"
        headers['Authorization'] = 'Token token="' + os.getenv('ACTION_HUB_LOAD_TESTING_API_KEY') + '"'

        response = self.client.post(uri, json=data, headers=headers)
        print("Response status code:", response.status_code)
        print("Response content:", response.text)

class MyLocust(HttpLocust):
    task_set = ActionHubTaskSet
