﻿//******************************************************************************************
//* Main visualization namespace
//******************************************************************************************
Vis = {
    positions : null,   //array of authors and their positions
	s : null,           //the network's skewness
	scale : null,       //scale factor
};

//******************************************************************************************
//* WebGL stuff
//******************************************************************************************
Vis.WebGL = {
    Context : null,     //contains the WebGL context
    //******************************************************************************************
    //* @PUBLIC: Initializes the WebGL stuff
    //******************************************************************************************
    Init : function(positions, s) {
        if (!Vis.WebGL.CreateContext($('vis-canvas'))) {
            alert("Could not initialise WebGL!");
            return;
        }
        Vis.positions = positions;
        Vis.s = s;
        
        Vis.WebGL.Shaders.Init();
        Vis.WebGL.Buffers.Init();

        Vis.WebGL.Context.clearColor(0.9, 0.9, 0.9, 1.0);
        Vis.WebGL.Context.enable(Vis.WebGL.Context.DEPTH_TEST);

        Vis.WebGL.Scene.Draw();
    },
    //******************************************************************************************
    //* @PRIVATE:   Create the WebGL context
    //* @RETURN:    [bool] true if WebGL context has been created
    //******************************************************************************************
    CreateContext : function(canvas) {
        try {
            Vis.WebGL.Context = canvas.getContext("experimental-webgl");
            Vis.WebGL.Context.viewportWidth = canvas.width;
            Vis.WebGL.Context.viewportHeight = canvas.height;
            return true;
        } catch (e) {
            return false;
        }
        if (!Vis.WebGL.Context) {
            return false;
        }
    }
};

//******************************************************************************************
//* Contains the WebGL scene
//******************************************************************************************
Vis.WebGL.Scene = {
    ModelViewMatrix : mat4.create(),
    ProjectionMatrix : mat4.create(),
    //******************************************************************************************
    //* @PUBLIC: Draws the scene
    //******************************************************************************************
    Draw : function() {
        var gl = Vis.WebGL.Context;
        var positions = Vis.positions;
        var s = Vis.s;

        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, this.ProjectionMatrix);
        mat4.identity(this.ModelViewMatrix);

		//draw the ellipsis
		mat4.translate(this.ModelViewMatrix, [0.0, 0.0, -4.0]);
		gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.Ellipsis);
		gl.vertexAttribPointer(Vis.WebGL.Shaders.BasicShader.vertexPositionAttribute, Vis.WebGL.Buffers.Ellipsis.itemSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.EllipsisColor);
		gl.vertexAttribPointer(Vis.WebGL.Shaders.BasicShader.vertexColorAttribute, Vis.WebGL.Buffers.EllipsisColor.itemSize, gl.FLOAT, false, 0, 0);
		this.SetMatrixUniforms(Vis.WebGL.Shaders.BasicShader);
		gl.drawElements(gl.TRIANGLES, Vis.WebGL.Buffers.EllipsisIndex.numItems, gl.UNSIGNED_SHORT, 0);

		//draw authors (position is coded here)
		var inv, x, y;
		for (var i=0; i<positions.length; i++) {
		    //involvement = sqrt(x² + y²)
		    if ((inv = Math.sqrt(Math.pow(positions[i].p1, 2) + Math.pow(positions[i].p2, 2))) != 0) {
		        x = Vis.scale * positions[i].p1 / inv;
                y = s * Vis.scale * positions[i].p2 / inv;
                
                //set viewpoint on the ellipsis and a tiny bit to the foreground...
                mat4.translate(this.ModelViewMatrix, [x, y, 0.000001]);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.Users[i]);
                gl.vertexAttribPointer(Vis.WebGL.Shaders.BasicShader.vertexPositionAttribute, Vis.WebGL.Buffers.Users[i].itemSize, gl.FLOAT, false, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.UserColors[i]);
                gl.vertexAttribPointer(Vis.WebGL.Shaders.BasicShader.vertexColorAttribute, Vis.WebGL.Buffers.UserColors[i].itemSize, gl.FLOAT, false, 0, 0);
                this.SetMatrixUniforms(Vis.WebGL.Shaders.BasicShader);
                gl.drawElements(gl.TRIANGLES, Vis.WebGL.Buffers.UserIndices[i].numItems, gl.UNSIGNED_SHORT, 0);
                //...and back
                mat4.translate(this.ModelViewMatrix, [-x, -y, 0.0]);
            }
		}
	},
    //******************************************************************************************
    //* @PRIVATE: Sets the matrix uniforms for the given shader program
    //* @PARAM: [shader] the shader program
    //******************************************************************************************
    SetMatrixUniforms : function(shaderProgram) {
        Vis.WebGL.Context.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, this.ProjectionMatrix);
        Vis.WebGL.Context.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, this.ModelViewMatrix);
    }
};

//******************************************************************************************
//* WebGL Shaders
//******************************************************************************************
Vis.WebGL.Shaders = {
    BasicShader : null,     //Basic shader program
    //******************************************************************************************
    //* Initializes the shaders
    //******************************************************************************************
    Init : function() {
        var gl = Vis.WebGL.Context;
        var fragmentShader = Vis.WebGL.Shaders.GetShader("basic-shader-fs");
        var vertexShader = Vis.WebGL.Shaders.GetShader("basic-shader-vs");

        this.BasicShader = gl.createProgram();
        var shaderProgram = this.BasicShader;
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
            return;
        }

        gl.useProgram(shaderProgram);

        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

		shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
		gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
        shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    },
    //******************************************************************************************
    //* @PUBLIC: Gets the shader specified by id
    //* @RETURN: returns the shader
    //******************************************************************************************
    GetShader : function(id) {
        if (Vis.WebGL.Context == null) {
            alert("Context not available!");
            return;
        }

        var shaderScript = $(id);
        if (!shaderScript) {
            return null;
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = Vis.WebGL.Context.createShader(Vis.WebGL.Context.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = Vis.WebGL.Context.createShader(Vis.WebGL.Context.VERTEX_SHADER);
        } else {
            return null;
        }

        Vis.WebGL.Context.shaderSource(shader, str);
        Vis.WebGL.Context.compileShader(shader);

        if (!Vis.WebGL.Context.getShaderParameter(shader, Vis.WebGL.Context.COMPILE_STATUS)) {
            alert(Vis.WebGL.Context.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }
};

//******************************************************************************************
//* WebGL Buffers
//******************************************************************************************
Vis.WebGL.Buffers = {
    Ellipsis : null,
	EllipsisColor : null,
	EllipsisIndex : null,
    Users : Array(),
	UserColors : Array(),
	UserIndices : Array(),
    //******************************************************************************************
    //* Initializes the buffers
    //******************************************************************************************
    Init : function() {
        var gl = Vis.WebGL.Context;
        var positions = Vis.positions;
        var s = Vis.s;
        var n = 48;     //number of ellipsis vertices

		//big ellipsis
		vertices = [0, 0, 0];
		var normalData = [0, 0, 1];
		var unpackedColors = [1, 0, 0, 0.8];
		var cubeVertexIndices = [];
		
		//scaling factor - FIXME - might need more magic to make the drawing always fit in the screen 
		Vis.scale = 2; 
		
		for (var j = 0; j < n; j++) {
		    vertices = vertices.concat([Vis.scale * Math.cos(j * 2*Math.PI/n), s * Vis.scale * Math.sin(j * 2*Math.PI/n), 0.0]);
		    normalData = normalData.concat([0, 0, 1]);
		    unpackedColors = unpackedColors.concat([1.0, 0.0, 0.0, 0.4]);
		    cubeVertexIndices = cubeVertexIndices.concat([0,j+1,(j+1<n?j+2:1)]);
		}

		Vis.WebGL.Buffers.Ellipsis = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.Ellipsis);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		Vis.WebGL.Buffers.Ellipsis.itemSize = 3;
		Vis.WebGL.Buffers.Ellipsis.numItems = vertices.length / Vis.WebGL.Buffers.Ellipsis.itemSize;
 
		Vis.WebGL.Buffers.EllipsisColor = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, Vis.WebGL.Buffers.EllipsisColor);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedColors), gl.STATIC_DRAW);
		Vis.WebGL.Buffers.EllipsisColor.itemSize = 4;
		Vis.WebGL.Buffers.EllipsisColor.numItems = unpackedColors.length / Vis.WebGL.Buffers.EllipsisColor.itemSize;

		Vis.WebGL.Buffers.EllipsisIndex = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Vis.WebGL.Buffers.EllipsisIndex);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
		Vis.WebGL.Buffers.EllipsisIndex.itemSize = 1;
		Vis.WebGL.Buffers.EllipsisIndex.numItems = cubeVertexIndices.length / Vis.WebGL.Buffers.EllipsisIndex.itemSize;

		//Authors (more ellipses)
		var ratio, inv, a, b;
		var User, UserColor, UserIndex;     //Buffers
		for (var i=0; i<positions.length; i++) {
		    if ((inv = Math.sqrt(Math.pow(positions[i].p1, 2) + Math.pow(positions[i].p2, 2))) != 0) {
		        vertices = [0, 0, 0];
		        normalData = [0, 0, 1];
		        unpackedColors = [0.0, 0.8, 0.4, 1.0];
		        cubeVertexIndices = [];
		        
		        ratio = positions[i].out / (positions[i].in + 0.01);    //just to make sure we don't divide by zero
		        ratio = ratio < 0.333 ? 0.333 : ratio;  //limit the ratio
		        ratio = ratio > 3 ? 3 : ratio;
		        
		        /*  ratio = b / a
		            inv ~ PI * a * b
		            =>  inv ~ PI * a * a * ratio
		            =>  (PI*a*a*ratio) / inv = const.
		            =>  a² = const. * inv / (PI * ratio)    */
		        
		        a = Math.sqrt(0.05 * inv / (Math.PI * ratio));  //the constant may require some testing
		        b = a * ratio;
		        
		        for (var j = 0; j < n; j++) {
		            vertices = vertices.concat([a * Math.cos(j * 2*Math.PI/n), b * Math.sin(j * 2*Math.PI/n), 0.0]);
		            normalData = normalData.concat([0, 0, 1]);
		            unpackedColors = unpackedColors.concat([0.0, 0.8, 0.4, 1.0]);
		            cubeVertexIndices = cubeVertexIndices.concat([0,j+1,(j+1<n?j+2:1)]);
		        }

		        User = gl.createBuffer();
		        gl.bindBuffer(gl.ARRAY_BUFFER, User);
		        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		        User.itemSize = 3;
		        User.numItems = vertices.length / User.itemSize;
		        Vis.WebGL.Buffers.Users[i] = User;
         
		        UserColor = gl.createBuffer();
		        gl.bindBuffer(gl.ARRAY_BUFFER, UserColor);
		        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedColors), gl.STATIC_DRAW);
		        UserColor.itemSize = 4;
		        UserColor.numItems = unpackedColors.length / UserColor.itemSize;
		        Vis.WebGL.Buffers.UserColors[i] = UserColor;

		        UserIndex = gl.createBuffer();
		        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, UserIndex);
		        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
		        UserIndex.itemSize = 1;
		        UserIndex.numItems = cubeVertexIndices.length / UserIndex.itemSize;
		        Vis.WebGL.Buffers.UserIndices[i] = UserIndex;
		    }
		}
	}
};
