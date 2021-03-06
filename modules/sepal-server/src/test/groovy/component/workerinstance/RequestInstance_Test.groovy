package component.workerinstance

import org.openforis.sepal.component.workerinstance.event.FailedToRequestInstance
import org.openforis.sepal.component.workerinstance.event.InstanceLaunched
import org.openforis.sepal.component.workerinstance.event.InstancePendingProvisioning

class RequestInstance_Test extends AbstractWorkerInstanceTest {
    def 'Given no idle instances, when requesting instance, instance is launched, and event is published'() {
        when:
        def instance = requestInstance()

        then:
        def launchedInstance = instanceProvider.launchedOne()
        instance == launchedInstance
        def event = published InstanceLaunched
        event.instance == instance
    }

    def 'Given an idle instance, when requesting instance, instance is reserved, no additional instance is launched, and event is published'() {
        def idleInstance = idleInstance()

        when:
        def instance = requestInstance()

        then:
        instance.id == idleInstance.id
        instanceProvider.reservedOne()
        instanceProvider.launchedOne()
        def event = published InstancePendingProvisioning
        event.instance == instance
    }

    def 'When failing to request instance, event is published and exception is thrown'() {
        instanceProvider.fail()

        when:
        requestInstance()

        then:
        published(FailedToRequestInstance)
        thrown Exception
    }
}
