import logging

import ee

from ..gee import get_info
from . import monitor
from .monitor import MonitorEarthEngineExportTask
from ..gee import export_semaphore
from ..task.task import ThreadTask

logger = logging.getLogger(__name__)


class ImageToCloudStorage(ThreadTask):
    def __init__(
            self,
            credentials,
            image,
            description,
            region,
            folder,
            scale,
            maxPixels=1e12,
            shardSize=256,
            fileDimensions=4096,
            skipEmptyTiles=None):
        super(ImageToCloudStorage, self).__init__(retries=3, semaphore=export_semaphore)
        self.credentials, self.image, self.description, self.folder, self.scale, self.region, self.maxPixels, \
        self.shardSize, self.fileDimensions, self.skipEmptyTiles = (
            credentials, image, description, folder, scale, region, maxPixels, shardSize, fileDimensions, skipEmptyTiles
        )
        self._monitor = None

    def status(self):
        if self._monitor:
            return self._monitor.status()
        else:
            return monitor.State.PENDING

    def status_message(self):
        if not self._monitor:
            return 'Export pending...'
        else:
            return self._monitor.status_message()

    def run(self):
        ee.InitializeThread(self.credentials)
        task_id = self._image_to_cloud_storage()
        self._monitor = self.dependent(
            MonitorEarthEngineExportTask(self.credentials, task_id, self.description)
        )

        self._monitor \
            .submit() \
            .then(self.resolve, self.reject)

    def _image_to_cloud_storage(self):
        task = ee.batch.Export.image.toCloudStorage(
            image=self.image,
            description=self.description,
            bucket='sepal_dev-daniel_exports',
            fileNamePrefix=self.folder + '/',
            region=get_info(self.region.bounds())['coordinates'],
            crs='EPSG:4326',
            scale=self.scale,
            maxPixels=self.maxPixels,
            shardSize=self.shardSize,
            fileDimensions=self.fileDimensions,
            skipEmptyTiles=self.skipEmptyTiles
        )
        task.start()
        return task.status()['id']

    def __str__(self):
        return '{0}(description={1}, folder={2})'.format(type(self).__name__, self.description, self.folder)
