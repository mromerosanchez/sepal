const ee = require('ee')
const {concat, defer} = require('rx')
const {switchMap} = require('rx/operators')
const {finalize, swallow} = require('sepal/rxjs/operators')
const {limiter$: exportLimiter$} = require('root/jobs/service/exportLimiter')
const drive = require('root/drive')
const {initUserBucket$} = require('root/cloudStorageBucket')
const cloudStorage = require('root/cloudStorageDownload')
const log = require('sepal/log').getLogger('ee')
const {getCurrentContext$} = require('root/jobs/service/context')
const {limiter$: driveSerializer$} = require('root/jobs/service/driveSerializer')
const task$ = require('root/ee/task')

const CONCURRENT_FILE_DOWNLOAD = 3

const drivePath = folder =>
    `SEPAL/exports/${folder}`

const createDriveFolder$ = folder =>
    defer(() => driveSerializer$(
        drive.getFolderByPath$({path: drivePath(folder), create: true})
    )).pipe(
        swallow()
    )

const exportImageToSepal$ = ({
    image,
    folder,
    description,
    downloadDir,
    dimensions,
    region,
    scale,
    crs,
    crsTransform,
    maxPixels = 1e13,
    shardSize,
    fileDimensions,
    skipEmptyTiles,
    fileFormat,
    formatOptions,
    retries
}) => {
    const prefix = description

    const throughCloudStorage$ = () => {
        const exportToCloudStorage$ = ({task, description, _retries}) => {
            log.debug('Earth Engine <to Cloud Storage>:', description)
            return exportLimiter$(
                task$(task, description)
            )
        }
        const cloudStoragePrefix = `${folder}/`
        return initUserBucket$().pipe(
            switchMap(bucketPath =>
                concat(
                    exportToCloudStorage$({
                        task: ee.batch.Export.image.toCloudStorage(
                            image, description, bucketPath, `${folder}/${prefix}`, dimensions, region, scale, crs,
                            crsTransform, maxPixels, fileDimensions, skipEmptyTiles, fileFormat, formatOptions
                        ),
                        description: `export to Sepal through CS (${description})`,
                        retries
                    }),
                    cloudStorage.download$({
                        bucketPath,
                        prefix: cloudStoragePrefix,
                        downloadDir,
                        deleteAfterDownload: true
                    })
                ).pipe(
                    finalize(() => cloudStorage.delete$({bucketPath, prefix: cloudStoragePrefix}),
                        `Delete Cloud Storage files: ${bucketPath}:${cloudStoragePrefix}`)
                )
            )
        )
    }

    const throughDrive$ = () => {
        const exportToDrive$ = ({task, description, folder, _retries}) => {
            log.debug('Earth Engine <to Google Drive>:', description)
            return exportLimiter$(
                concat(
                    createDriveFolder$(folder),
                    task$(task, description)
                )
            )
        }

        const downloadFromDrive$ = ({path, downloadDir}) =>
            drive.downloadSingleFolderByPath$(path, downloadDir, {
                concurrency: CONCURRENT_FILE_DOWNLOAD,
                deleteAfterDownload: true
            })

        return concat(
            exportToDrive$({
                task: ee.batch.Export.image.toDrive(
                    image, description, folder, prefix, dimensions, region, scale, crs,
                    crsTransform, maxPixels, shardSize, fileDimensions, skipEmptyTiles, fileFormat, formatOptions
                ),
                description: `export to Sepal through Drive (${description})`,
                folder,
                retries
            }),
            downloadFromDrive$({
                path: drivePath(folder),
                downloadDir
            })
        ).pipe(
            finalize(() => drive.removeFolderByPath$({path: drivePath(folder)}), `Delete drive folder: ${folder}`)
        )
    }

    return getCurrentContext$().pipe(
        switchMap(({isUserAccount}) =>
            isUserAccount
                ? throughDrive$()
                : throughCloudStorage$()
        )
    )
}

module.exports = {exportImageToSepal$}
