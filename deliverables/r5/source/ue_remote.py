import json
import pathlib
import sys
import time

sys.path.insert(
    0,
    r"D:\UE_5.8\Engine\Plugins\Experimental\PythonScriptPlugin\Content\Python",
)
import remote_execution


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: ue_remote.py <script.py>")

    script_path = pathlib.Path(sys.argv[1])
    code = script_path.read_text(encoding="utf-8")

    remote = remote_execution.RemoteExecution()
    remote.start()
    try:
        deadline = time.time() + 10
        nodes = []
        while time.time() < deadline:
            nodes = remote.remote_nodes
            if nodes:
                break
            time.sleep(0.25)
        if not nodes:
            raise RuntimeError("No Unreal Python remote node found")

        project_nodes = [n for n in nodes if n.get("project_name") == "blockRush"]
        node = project_nodes[0] if project_nodes else nodes[0]
        remote.open_command_connection(node["node_id"])
        result = remote.run_command(
            code,
            unattended=True,
            exec_mode=remote_execution.MODE_EXEC_FILE,
            raise_on_failure=False,
        )
        print(json.dumps(result, ensure_ascii=False))
        if not result.get("success"):
            raise SystemExit(1)
    finally:
        remote.stop()


if __name__ == "__main__":
    main()
