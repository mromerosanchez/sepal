import {connect} from 'store'
import {currentUser, loadCurrentUser$} from 'user'
import Home from 'app/home/home'
import Landing from 'app/landing/landing'
import Notifications from 'app/notifications'
import PropTypes from 'prop-types'
import React from 'react'
import ReactResizeDetector from 'react-resize-detector'
import actionBuilder from 'action-builder'

import css1 from 'bootstrap/dist/css/bootstrap-reboot.css'
import css2 from './app.css'
import css3 from '../style/button-colors.default.css'
const CSS = {css1, css2, css3} // eslint-disable-line no-unused-vars

const mapStateToProps = () => ({
    currentUser: currentUser()
})

class App extends React.Component {
    UNSAFE_componentWillMount() {
        this.props.asyncActionBuilder('LOAD_CURRENT_USER',
            loadCurrentUser$())
            .dispatch()
    }

    render() {
        return (
            <div className='app'>
                <Notifications/>
                <ReactResizeDetector
                    handleWidth
                    handleHeight
                    onResize={(width, height) =>
                        actionBuilder('SET_APP_DIMENSIONS')
                            .set('dimensions', {width, height})
                            .dispatch()
                    }/>
                {this.body()}
            </div>
        )
    }

    body() {
        const {currentUser, action} = this.props
        return action('LOAD_CURRENT_USER').dispatched
            ? currentUser
                ? <Home user={currentUser}/>
                : <Landing/>
            : <Loader/>
    }
}

App.propTypes = {
    currentUser: PropTypes.object
}

const Loader = () =>
    <div className="app-loader">
        <span/>
        <p>S E P A L</p>
    </div>

export default connect(mapStateToProps)(App)