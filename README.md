# Digital Asset Downloader

This desktop app is under development. Download product images and PDFs in bulk using an Excel workbook, a CSV file, or the results of a SQL Server query. The desktop app matches each row to a part number and writes an Excel workbook with the results.

## Install on Windows

Open [GitHub Releases](https://github.com/w00dy1981/DigitalAssetsDownloader/releases) and run the Windows x64 `Digital-Asset-Downloader-Setup-*.exe` installer under **Assets**. The [automated release workflow](.github/workflows/auto-release.yml) builds the Windows installer. The project also has local packaging commands for macOS and Linux.

## Download assets

1. In **Input Selection**, choose **Excel / CSV** or **SQL Server**.
   - For a file, use **Browse** or drag in an `.xlsx` or `.csv` file. For a workbook, choose the worksheet and review the preview. If you have an older `.xls` workbook, save it as `.xlsx` first.
   - For SQL Server, enter the server, database, username, and password. Use **Test Connection** to check access. Enter a read-only `SELECT` query, click **Preview Query**, then click **Load SQL Data**. The app limits the number of rows it loads and shows the limits below the query box. Query text is kept for the current session.
2. In **Column Selection**, choose the **Part Number Column** and a column for image URLs, PDF URLs, or both. Pick a download folder for each selected asset type.
3. To reuse existing images, set **Source Image Folder**. The app searches it by part number or by the **Custom Filename Column** if you select one. To reference images on a shared drive in the workbook, set **Image Network Path** in **Settings** before loading your input. Downloads go to the selected download folders.
4. In **Process & Download**, review the configuration and click **Start Downloads**. Use **Download Progress** and **Activity Log** to see how the run is going. For images, set **JPEG Quality** and choose whether transparent areas should have a white background. The app keeps WebP files in their original format.

Look for `DownloadLog_*.xlsx` in the image download folder, or in the PDF download folder if no image folder is configured. Open **Download Log** to see per-file results, paths, and error messages. The **ERP Import** sheet contains rows prepared for import.

Each attempted image or PDF gets a row in **Download Log**. **ERP Import** combines successful references from the same input row. The photo reference uses the configured image network folder. **Product Data Sheet** uses the exact PDF filename on disk.

The downloader assigns filenames before it starts workers. Codes that need escaping or case protection get a stable suffix so running a subset later still updates the same product. Repeated rows for the same code receive numbered filenames within that run. A later run can replace that product’s earlier files. For an existing workbook that points to older filenames, run the input again to generate updated references.

## Settings and updates

Use **Settings** to change default folders, download concurrency, timeouts, retries, image processing, and SQL Server defaults. Changes save automatically. **Reset to Defaults** restores the app's defaults.

To reuse a SQL login on the same device, select **Remember SQL password on this device** in **Input Selection**. Use **Forget saved password** to remove it.

In a packaged build with update support, the app can check for updates on startup. You can also choose **Settings**, then **Check for Updates Now**. When an update appears in **Input Selection**, click **Download Update**, then **Install & Restart** when you're ready.

## Run from source

Use npm and Node.js 20.12.2 or later to meet the requirements of the locked dependencies.

```bash
git clone https://github.com/w00dy1981/DigitalAssetsDownloader.git
cd DigitalAssetsDownloader
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the Electron main process and React interface. |
| `npm run lint` | Check the source with ESLint. |
| `npm test` | Run the Jest tests. |
| `npm run dist` | Build a package for the current platform. |
| `npm run dist:win` | Build a Windows installer. |
| `npm run dist:mac` | Build a macOS DMG. |
| `npm run dist:linux` | Build Linux AppImage and Debian packages. |

## Troubleshooting

- If a workbook won't open, check that you can open it in Excel and save a fresh `.xlsx` copy.
- If a SQL query fails, check the connection first. Then check that the query is a read-only `SELECT` and that the account can read the tables it uses.
- If a download fails, check the URL and the destination folder. Look in **Activity Log** during the run or in the **Download Log** worksheet afterwards.

If the problem persists, check [GitHub Issues](https://github.com/w00dy1981/DigitalAssetsDownloader/issues) for an existing report. Include your app version, operating system, steps to reproduce the problem, and the error message. Remove credentials and private URLs before sharing logs or screenshots.

## Licence

[MIT](LICENSE)
