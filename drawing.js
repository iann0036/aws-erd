var canvas;
var processed_resources = [];
var property_ports = {};

function addResourceAtPosition(canvas, cfnspec, rtm, resource, x, y) {
    // add to dupe check list
    processed_resources.push(resource);

    // init
    var max_width_resource = 0;
    var offsetx = x;
    var offsety = y;

    // create heading
    label = new draw2d.shape.basic.Label({
        text: resource,
        bold: true,
        x: offsetx,
        y: offsety,
        stroke: 0,
        resizeable: false,
        selectable: false
    }).setDraggable(false).setDeleteable(false);
    canvas.add(label);
    max_width_resource = Math.max(max_width_resource,label.getWidth());
    offsety += 4;

    // create props
    for (var prop in cfnspec.ResourceTypes[resource].Properties) {
        offsety += 14;
        label = new draw2d.shape.basic.Label({
            text: prop,
            bold: false,
            x: offsetx,
            y: offsety,
            stroke: 0,
            resizeable: false,
            selectable: false
        }).setDraggable(false).setDeleteable(false);

        canvas.add(label);
        max_width_resource = Math.max(max_width_resource,label.getWidth());
    }

    // go to below last item
    offsety += 24;

    // add sub-resources
    for (var rtm_resource in rtm) {
        if (rtm[rtm_resource].Relationships.hasOwnProperty("IsContainedInside")) {
            if (rtm[rtm_resource].Relationships.IsContainedInside.hasOwnProperty(resource)) {
                if (!processed_resources.includes(rtm_resource)) {
                    var res_ret = addResourceAtPosition(canvas, cfnspec, rtm, rtm_resource, offsetx + 10, offsety + 10)
                    max_width_resource = Math.max(max_width_resource, res_ret[0] + 20);
                    offsety += res_ret[1] + 20;
                }
            }
        }
    }

    // create the wrapper
    wrapperColor = "#A8DBA8";
    if (rtm[resource].EntityType == "Container")
        wrapperColor = "#E8DDCB";
    else if (rtm[resource].EntityType == "Link")
        wrapperColor = "#D4F0F9";
    else if (rtm[resource].EntityType != "Element")
        wrapperColor = "#E5725C";
    var wrapper = new draw2d.shape.basic.Rectangle({
        x: x,
        y: y,
        width: max_width_resource,
        height: offsety - y,
        bgColor: wrapperColor,
        stroke: 2,
        resizeable: false,
        selectable: false
    }).setDraggable(false).setDeleteable(false);
    
    // add ports
    left_port = new draw2d.HybridPort({
        visible: false
    });
    right_port = new draw2d.HybridPort({
        visible: false
    });
    wrapper.addPort(left_port, new draw2d.layout.locator.LeftLocator());
    wrapper.addPort(right_port, new draw2d.layout.locator.RightLocator());
    property_ports[resource] = [left_port, right_port];

    // add wrapper
    canvas.add(wrapper);
    wrapper.toBack();

    return [max_width_resource, offsety - y];
}

function getCanvasImage() {
    return new Promise(function(resolve, reject) {
        canvas.setCurrentSelection(null);
        var xCoords = [];
        var yCoords = [];
        canvas.getFigures().each(function(i,f){
            var b = f.getBoundingBox();
            xCoords.push(b.x, b.x+b.w);
            yCoords.push(b.y, b.y+b.h);
        });
        var minX   = Math.min.apply(Math, xCoords) - 30;
        var minY   = Math.min.apply(Math, yCoords) - 30;
        var width  = Math.max.apply(Math, xCoords)-minX + 30;
        var height = Math.max.apply(Math, yCoords)-minY + 30;

        canvas.getAllPorts().each(function(i,p){ // hide figure ports for screenshot
            p.setVisible(false);
        });
        //gridPolicy.setGrid(1); // sexy hack to make background white
        
        var writer = new draw2d.io.png.Writer();
        writer.marshal(canvas,function(png){
            //gridPolicy.setGrid(5); // reset sexy hack
            resolve(png);
        }, new draw2d.geo.Rectangle(minX,minY,width,height));
    });
}

function exportCanvasImage() {
    getCanvasImage().then(function(png){
        var filename = "AWS-ERD.png";

        var element = document.createElement('a');
        element.setAttribute('href', png);
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);
        console.log(element);
        element.click();
        document.body.removeChild(element);
    });
}

$(window).load(function () {
    canvas = new draw2d.Canvas("gfx_holder");

    $.getJSON("CloudFormationResourceSpecification.json", function(cfnspec) {
        $.getJSON("RelationshipTypeMap.json", function(rtm) {
            var offsety = 10;
            var offsetx = 40;
            var max_width_column = 0;
            console.log(cfnspec);
            console.log(rtm);

            for (var resource in cfnspec.ResourceTypes) {
                if (!processed_resources.includes(resource)) { // check not already processed
                    if (!rtm[resource].Relationships.hasOwnProperty("IsContainedInside")) { // check not inside another resource
                        var res_ret = addResourceAtPosition(canvas, cfnspec, rtm, resource, offsetx, offsety);
                        offsety += res_ret[1]
                        max_width_column = Math.max(max_width_column, res_ret[0])
                        
                        offsety += 20;
                        if (offsety > 2800) {
                            offsety = 10;
                            offsetx += max_width_column + 20;
                            max_width_column = 0;
                        }
                    }
                }
            }

            /*
            for (var resource in cfnspec.ResourceTypes) {
                for (var relationship_type in rtm[resource].Relationships) {
                    if (relationship_type != "IsContainedInside") {
                        for (var linked_relationship in rtm[resource].Relationships[relationship_type]) {
                            if (property_ports.hasOwnProperty(linked_relationship)) {
                                var conn = new draw2d.Connection({
                                    router: new draw2d.layout.connection.ManhattanBridgedConnectionRouter()
                                });
                                //console.log(linked_relationship);
                                if (property_ports[resource][0].x > property_ports[linked_relationship][1].x) {
                                    conn.setSource(property_ports[resource][0]);
                                    conn.setTarget(property_ports[linked_relationship][1]);
                                } else if (property_ports[resource][1].x < property_ports[linked_relationship][0].x) {
                                    conn.setSource(property_ports[resource][1]);
                                    conn.setTarget(property_ports[linked_relationship][0]);
                                } else {
                                    conn.setSource(property_ports[resource][0]);
                                    conn.setTarget(property_ports[linked_relationship][0]);
                                }
                                
                                canvas.add(conn);
                            } else {
                                console.warn("Could not link to a " + linked_relationship);
                            }
                        }
                    }
                }
            }
            */
        });
    });
  
});