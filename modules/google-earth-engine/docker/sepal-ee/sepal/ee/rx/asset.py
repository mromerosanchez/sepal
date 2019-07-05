import ee

from .observables import execute


def delete_asset(asset_id):
    def delete():
        if ee.data.getInfo(asset_id):
            ee.data.deleteAsset(asset_id)

    return execute(delete, description='Delete asset ' + asset_id)
