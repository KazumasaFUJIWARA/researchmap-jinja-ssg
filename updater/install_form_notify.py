#!/usr/bin/env python3
"""Install onFormSubmit email notification for the contact Google Form.

Requires gws scopes (additive):
  gws-grant script.projects script.deployments forms.body forms.responses.readonly gmail.modify

Usage:
  CONTACT_NOTIFY_EMAIL=you@example.com python install_form_notify.py
  infisical run --env=dev -- python install_form_notify.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FORM_ID = "1zUgFEIyT8cJudOe-iNJg3b6geVUc4drQNtgkyRFNtZU"
NOTIFY_EMAIL = os.environ.get("CONTACT_NOTIFY_EMAIL", "").strip()
GWS_CONFIG = Path.home() / ".config" / "gws"


def gws_env() -> dict:
    env = os.environ.copy()
    if "GOOGLE_WORKSPACE_CLI_CONFIG_DIR" not in env and GWS_CONFIG.exists():
        tmp = Path(tempfile.mkdtemp(prefix="gws-config-"))
        shutil.copytree(GWS_CONFIG, tmp, dirs_exist_ok=True)
        env["GOOGLE_WORKSPACE_CLI_CONFIG_DIR"] = str(tmp)
    return env


def gws(args: list[str], params: dict | None = None, body: dict | None = None) -> dict:
    cmd = ["gws", *args, "--format", "json"]
    if params:
        cmd.extend(["--params", json.dumps(params)])
    if body is not None:
        cmd.extend(["--json", json.dumps(body, ensure_ascii=False)])
    proc = subprocess.run(cmd, capture_output=True, text=True, env=gws_env())
    stdout = proc.stdout
    if stdout.startswith("Using keyring"):
        stdout = stdout.split("\n", 1)[1]
    if proc.returncode != 0:
        print(proc.stdout, proc.stderr, file=sys.stderr)
        raise SystemExit(proc.returncode)
    return json.loads(stdout)


def find_existing_script() -> str | None:
    try:
        content = gws(["script", "projects", "getContent"], params={"scriptId": FORM_ID})
        return content.get("scriptId")
    except SystemExit:
        return None


def build_code() -> str:
    return f"""function onFormSubmit(e) {{
  const notify = '{NOTIFY_EMAIL}';
  const itemResponses = e.response.getItemResponses();
  const lines = itemResponses.map(function(item) {{
    return item.getItem().getTitle() + ': ' + item.getResponse();
  }});
  const subject = '[mypage contact] ' + (lines[2] || 'new message');
  const body = lines.join('\\n\\n');
  GmailApp.sendEmail(notify, subject, body);
}}

function installTrigger() {{
  ScriptApp.getProjectTriggers().forEach(function(t) {{
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  }});
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(FormApp.openById('{FORM_ID}'))
    .onFormSubmit()
    .create();
}}
"""


def upload_script(script_id: str) -> None:
    gws(
        ["script", "projects", "updateContent"],
        params={"scriptId": script_id},
        body={
            "files": [
                {"name": "Code", "type": "SERVER_JS", "source": build_code()},
                {
                    "name": "appsscript",
                    "type": "JSON",
                    "source": '{"timeZone":"Asia/Tokyo","exceptionLogging":"STACKDRIVER","runtimeVersion":"V8"}',
                },
            ]
        },
    )


def try_install_trigger(script_id: str) -> bool:
    try:
        version = gws(
            ["script", "projects", "versions", "create"],
            params={"scriptId": script_id},
            body={"description": "notify trigger"},
        )
        deployment = gws(
            ["script", "projects", "deployments", "create"],
            params={"scriptId": script_id},
            body={
                "versionNumber": version["versionNumber"],
                "description": "notify trigger",
                "manifestFileName": "appsscript",
            },
        )
        for run_id in (deployment.get("deploymentId"), script_id):
            try:
                gws(
                    ["script", "scripts", "run"],
                    params={"scriptId": run_id},
                    body={"function": "installTrigger", "devMode": False},
                )
                return True
            except SystemExit:
                continue
    except SystemExit:
        pass
    return False


def print_manual_steps(script_id: str) -> None:
    editor = f"https://script.google.com/home/projects/{script_id}/edit"
    print(f"Script uploaded: {script_id}")
    print(f"Open: {editor}")
    print("1. Select installTrigger in the function dropdown")
    print("2. Click Run and authorize Gmail when prompted")
    print("3. Submit a test response on the contact form")


def main() -> None:
    if not NOTIFY_EMAIL:
        print("Set CONTACT_NOTIFY_EMAIL (or inject via Infisical).", file=sys.stderr)
        raise SystemExit(1)

    script_id = find_existing_script()
    if not script_id:
        project = gws(
            ["script", "projects", "create"],
            body={"title": "ContactFormNotify", "parentId": FORM_ID},
        )
        script_id = project["scriptId"]

    upload_script(script_id)

    if try_install_trigger(script_id):
        print(f"Trigger installed on form {FORM_ID} -> {NOTIFY_EMAIL}")
        print("Submit a test response to confirm email delivery.")
        return

    print_manual_steps(script_id)


if __name__ == "__main__":
    main()
