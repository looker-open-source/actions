import * as D from "../framework";

import { DropboxSource } from "./dropbox";
import { GitHubSource } from "./github";
import { GoogleDriveSource } from "./google_drive";
import { SegmentSource } from "./segment";

export function allSources(): D.IntegrationSource[] {
  return [
    new DropboxSource(),
    new SegmentSource(),
    new GitHubSource(),
    new GoogleDriveSource(),
  ];
}
