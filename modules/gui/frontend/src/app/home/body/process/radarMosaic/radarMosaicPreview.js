import api from 'api'
import {SceneSelectionType} from 'app/home/body/process/mosaic/mosaicRecipe'
import {withRecipe} from 'app/home/body/process/recipeContext'
import EarthEngineLayer from 'app/home/map/earthEngineLayer'
import {sepalMap} from 'app/home/map/map'
import _ from 'lodash'
import React from 'react'
import {selectFrom} from 'stateUtils'
import {msg} from 'translate'
import {Button} from 'widget/button'
import {enabled} from 'widget/enableWhen'
import MapStatus from 'widget/mapStatus'
import Notifications from 'widget/notifications'

const mapRecipeToProps = recipe => ({recipe})

class MosaicPreview extends React.Component {
    state = {}

    render() {
        const {initializing, tiles, error} = this.state
        if (this.isHidden())
            return null
        else if (initializing)
            return (
                <MapStatus message={msg('process.mosaic.preview.initializing')}/>
            )
        else if (tiles && (!tiles.complete || tiles.failed))
            return (
                <MapStatus
                    loading={!tiles.complete}
                    message={msg('process.mosaic.preview.loading', {loaded: tiles.loaded, count: tiles.count})}
                    error={tiles.failed ? msg('process.mosaic.preview.tilesFailed', {failed: tiles.failed}) : error}/>
            )
        else
            return null
    }

    onProgress(tiles) {
        this.setState(prevState => ({...prevState, tiles, initializing: false}))
    }

    onError(e) {
        Notifications.error({
            title: msg('gee.error.title'),
            message: msg('process.mosaic.preview.error'),
            error: e.response ? msg(e.response.code, e.response.data) : null,
            timeout: 0,
            content: dismiss =>
                <Button
                    look='transparent'
                    shape='pill'
                    icon='sync'
                    label={msg('button.retry')}
                    onClick={() => {
                        dismiss()
                        this.reload()
                    }}
                />
        })
    }

    reload() {
        const {recipe} = this.props
        const context = sepalMap.getContext(recipe.id)
        context.removeLayer('preview')
        this.updateLayer(this.toPreviewRequest(recipe))
    }

    componentDidMount() {
        this.updateLayer(this.toPreviewRequest(this.props.recipe))
    }

    componentDidUpdate(prevProps) {
        const {recipe} = this.props
        const context = sepalMap.getContext(recipe.id)
        const previewRequest = this.toPreviewRequest(recipe)
        const layerChanged = !_.isEqual(previewRequest, this.toPreviewRequest(prevProps.recipe))
        if (layerChanged)
            this.updateLayer(previewRequest)
        context.hideLayer('preview', this.isHidden(recipe))
    }

    updateLayer(previewRequest) {
        if (this.isHidden())
            return
        const {recipe, componentWillUnmount$} = this.props
        const {initializing, error} = this.state
        const layer = new EarthEngineLayer({
            layerIndex: 0,
            bounds: previewRequest.recipe.model.aoi.bounds,
            mapId$: api.gee.preview$(previewRequest),
            props: previewRequest,
            onProgress: tiles => this.onProgress(tiles)
        })
        const context = sepalMap.getContext(recipe.id)
        const changed = context.setLayer({
            id: 'preview',
            layer,
            destroy$: componentWillUnmount$,
            onError: e => this.onError(e)
        })
        if (changed && initializing !== !!layer)
            this.setState(prevState => ({...prevState, initializing: !!layer, error: null}))
        else if (changed && error)
            this.setState(prevState => ({...prevState, error: null}))
    }

    isHidden() {
        const {recipe} = this.props
        return recipe.ui.hidePreview || !selectFrom(recipe, 'ui.bands.selection')
    }

    toPreviewRequest(recipe) {
        const selection = selectFrom(recipe, 'ui.bands.selection')
        return {
            recipe: _.omit(recipe, ['ui']),
            bands: selection && selection.split(', ')
        }
    }
}

const hasScenes = ({recipe}) => {
    const type = selectFrom(recipe, 'model.sceneSelectionOptions.type')
    const scenes = selectFrom(recipe, 'model.scenes') || {}
    return type !== SceneSelectionType.SELECT || Object.values(scenes)
        .find(scenes => scenes.length)
}

const removeLayer = ({recipe}) => {
    const context = sepalMap.getContext(recipe.id)
    context.removeLayer('preview')
}

MosaicPreview.propTypes = {}

export default (
    withRecipe(mapRecipeToProps)(
        enabled({when: hasScenes, onDisable: removeLayer})(
            MosaicPreview
        )
    )
)
