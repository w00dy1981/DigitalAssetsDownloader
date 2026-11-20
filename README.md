# Digital Asset Downloader

This desktop app is under development. Download product images and PDFs in bulk using an Excel workbook, a CSV file, or the results of a SQL Server query. The desktop app matches each row to a part number and writes an Excel workbook with the results.

## Install on Windows

Open [GitHub Releases](https://github.com/w00dy1981/DigitalAssetsDownloader/releases) and run the Windows x64 `Digital-Asset-Downloader-Setup-*.exe` installer under **Assets**. The [automated release workflow](.github/workflows/auto-release.yml) builds the Windows installer. The project also has local packaging commands for macOS and Linux.

## Download assets

1. In **Input Selection**, choose **Excel / CSV** or **SQL Server**.
   - For a file, use **Browse** or drag in an `.xlsx`, `.xlsm`, or `.csv` file. Choose the worksheet and click **Load Sheet**. If you have an older `.xls` workbook, save it as `.xlsx` first.
   - For SQL Server, enter your connection details. Leave **Database** empty to use the login's default database. Enter your SQL and click **Run SQL**. The server runs the batch once with the login's permissions, including any changes it makes to data. If it returns several tables, choose the one containing your asset rows. Check its columns, sample and total, then click **Use Result** to map all its rows. Click **Run SQL** again only when you want to execute the batch again.
2. In **Column Selection**, choose the **Part Number Column**. Map an image or PDF column, or supply images from a folder. Pick a download folder for each selected asset type.
   Supplier addresses starting with `www.` use HTTPS. You can also use full HTTP or HTTPS URLs and local file paths.
3. To reuse existing images, set **Source Image Folder**. The app searches it by part number or by the **Custom Filename Column** if you select one. It recognises images by their contents, including JPEGs named `.jfif` or `.jpe`. You can leave image URLs empty. For a PDF mapping without an image column, select **Include images from Source Image Folder with these PDFs** to include folder images too. To reference images on a shared drive in the workbook, choose **Image Network Path** while mapping columns or set the default in **Settings**. Downloads go to the selected download folders.
4. In **Process & Download**, review the configuration and click **Start Downloads**. Use **Download Progress** and **Activity Log** to see how the run is going. For images, set **JPEG Quality** and choose whether transparent areas should have a white background. The app keeps WebP files in their original format.

Look for `DownloadLog_*.xlsx` in the image download folder, or in the PDF download folder if no image folder is configured. Open **Download Log** to see per-file results, paths, and error messages. The **ERP Import** sheet contains rows prepared for import.

Each attempted image or PDF gets a row in **Download Log**. **ERP Import** combines successful references from the same input row. The photo reference uses the configured image network folder. **Product Data Sheet** uses the exact PDF filename on disk.

The downloader assigns filenames before it starts workers. Codes that need escaping or case protection get a stable suffix so running a subset later still updates the same product. Repeated rows for the same code receive numbered filenames within that run. A later run can replace that product’s earlier files. For an existing workbook that points to older filenames, run the input again to generate updated references.

## Settings and updates

Use **Settings** to change default folders, download concurrency, timeouts, retries, image processing, and SQL Server defaults. Set the SQL preview row count to control how many rows appear on screen. The desktop process holds the returned tables in memory, so use your SQL to select the rows you need. The SQL request timeout controls how long the driver waits for the first server response, in milliseconds. Set it to 0 to disable the driver’s request timer. Node timers support up to 2,147,483,647 milliseconds (about 24.9 days). Larger positive values can expire immediately.

HTTP connection and read timeouts are in seconds. Set either to 0 to disable that timer. Download attempts include the first request. Concurrent downloads and attempts take positive whole numbers. JPEG quality accepts 1 to 100.

Changes save automatically. **Reset to Defaults** restores the app's defaults.

To reuse a SQL login on the same device, select **Remember SQL password on this device** in **Input Selection**. Use **Forget saved password** to remove it.

In a packaged build with update support, the app can check for updates on startup. You can also choose **Settings**, then **Check for Updates Now**. When an update appears in **Input Selection**, click **Download Update**, then **Install & Restart** when you're ready.

## Run from source

Use Node.js 22 and npm, the versions used by the project’s checks and Windows release build.

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
- If a SQL query fails, check the connection first. Then check the SQL Server error and the permissions granted to the login.
- If a download fails, check the URL and the destination folder. Look in **Activity Log** during the run or in the **Download Log** worksheet afterwards.

If the problem persists, check [GitHub Issues](https://github.com/w00dy1981/DigitalAssetsDownloader/issues) for an existing report. Include your app version, operating system, steps to reproduce the problem, and the error message. Remove credentials and private URLs before sharing logs or screenshots.

## Licence

[MIT](LICENSE)
