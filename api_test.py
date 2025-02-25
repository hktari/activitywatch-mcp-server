import requests
import json

# Test ActivityWatch query API directly
def test_query_api():
    API_URL = "http://localhost:5600/api/0/query/"
    
    # Simple test query
    test_query = {
        "timeperiods": [
            "2024-10-28/2024-10-29",
        ],
       "query":[
           ["RETURN = query_bucket(\'aw-watcher-window_UNI-qUxy6XHnLkk\')"]
        ],
    }
    
    # Test with increasingly complex queries
    queries = [
        ["RETURN = 1;"],
        ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
    ]
    
    for q in queries:
        test_query["query"] = q
        print(f"\nTesting query: {q}")
        
        try:
            response = requests.post(API_URL, json=test_query)
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                print(f"Success: {json.dumps(response.json(), indent=2)}")
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"Exception: {str(e)}")

if __name__ == "__main__":
    test_query_api()