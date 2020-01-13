var table_state = 'Activities';     // what is currently being displayed?
var datatable;
// var table_source;                   // store data for the DataTables plugin to render
// var resource_table = {"Activities": []};
var table_ref;                      // reference variable for accessing the data table
var select_expanded = false;        // used to dynamically render the dropdown- checkbox menu
// const columns = [{ title: "Resource Name" }, { title: "Description" }, { title: "Duration" }, { title: "Grade Level "},
//                     { title: "Subject" }, { title: "Tech Required "}, { title: "Author" }];

var Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: API_KEY
});
var base = Airtable.base('app2FkHOwb0jN0G8v');

// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    // console.log('table length ' + resource_table.Activities.length);
    // _buildTable();
    _renderSelects();
    _setupFeatures();
    _handleSearch();

    //work around to putting the text search with other filters and initially hiding the table
    $('#tech-filters').prepend($("#resource-table_filter"));
    $("#resource-table_filter").css('margin', '0');
    // $('#resource-table_wrapper').hide();
    $('#content').hide();

    $('.star').click(function() {
        var num_stars = event.target.id.split("star")[1];
        var activity_name = $(event.target).parent().attr('id');
        if(num_stars == 1)
            num_stars += " star"
        else
            num_stars += " stars"
        confirm("Would you like to submit a rating of " + num_stars + " for " + activity_name + "?");
    });

    $('#scroll-right').click(function() {
        $('.feature-list').animate( {scrollLeft: '+=640' }, 500);
    });
    $('#scroll-left').click(function() {
        $('.feature-list').animate( {scrollLeft: '-=640' }, 500);
    });
});

/*
    Render the datatable with activities filtered by user
    @param {boolean} search - 'true' if user has filtered activities. 
        'false' if the whole table should be rendered
    search is becoming a default condition for rendering the table, which means we could remove it as an argument
*/
function renderTable(search=true) {
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    $('.grid-container').show();
    search_results = [];
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: query_string
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        records.forEach(function(record) {
            search_results.push(record.fields);
        });
        renderFeatures(search_results);
        _buildTable(search_results);
        document.querySelector('#content').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/* 
    Reset all filters to their default values
*/
function resetFilters() {
    _resetFilters();
    $('input[type="search"]').val("");
    renderTable();
}

/*
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

/*
    Add 3 features to the top of the page. 
    For now these can be any activities with thumbnails in the base.
    @private
*/
function _setupFeatures() {
    var feature_list = [];
    base('Activities').select({
        view: 'Grid view',
        filterByFormula: "NOT({Thumbnail} = '')"
    }).firstPage(function(err, records) {
        if (err) { console.error(err); return; }
        records.forEach(function(record) {
            feature_list.push(record.fields);
        });
        _buildFeatureCarousel(feature_list);
    });
}

/*
    Create three features to appear above the table. Features can fit whatever criteria we want-
    ideally this would tie in to our rating system. In this version, the features are also rendered
    into a carousel using Slick.
    @param {array} feature_list - a list of activities that could be used as features. Currently this
        is all activities with an "Img URL" field
    @returns {array} features - featured activities to display above the table
    @private
*/
function _buildFeatureCarousel(features) {
    features.map(function(item, i) {
        var feature_id = 'feature' + i;
        var subjects = Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"];
        var resource_link = '<a target="_blank" href="'+ item["Resource Link"] +'">'+ item["Resource Name"] +'</a>';
        // if(item['Tags'].includes('incomplete')) 
        //     resource_link = _adaptActivity(resource_link, i, item["Resource Name"]);
        // data-lazy="`+ item["Thumbnail"][0].url +`" /></div><br />
            // <a href="#" data-featherlight="#`+ feature_id +`"><div><img src="` + item.Thumbnail[0].url + `" /></div>
        var feature_div = `
        <a href="#" data-featherlight="#`+ feature_id +`"><img src="` + item.Thumbnail[0].url + `" />
            <span class="feature-link">`+ item["Resource Name"] +`</span></a>
                <div style="display: none"><div id="`+ feature_id +`" style="padding: 10px;">
                    <h3>Activity Page: ` + resource_link + `</h3>
                    <br />`+ item["Description"] +`<br /><br />
                    <b>Experience Level: </b>`+ item["Experience"] +`<br />
                    <b>Subject: </b>`+ subjects +`<br />
                    <b>This activity requires the following materials: </b>`+ item["Materials"] +`<br />
                    <b>Created by: </b><a href="`+ item["Source Link"] +`">`+ item["Source"] +`</a>
                </div>`;
        $(".feature-list").append("<li>" + feature_div + "</li>");
        // $("#featured-activities").append("<div class='thumbnail' list-index='" + features.indexOf(item) + "'>" + feature_div + "</div>");
    });
    $('.feature-list').css('grid-template-columns', 'repeat(' + features.length + ', 300px)');
}

/*
    Build a query string for the Airtable API. This query will take into account all filters 
    and the text-based search.
*/
function _getQueryString() {
    var query = "AND(";
    if($('#subject').val() != "") 
        query += "Find('" + $('#subject').val() + "', Subject), ";
        // search_params.push("Subject=" + $('#subject').val());

    if($('#experience').val() != "") 
        query += "Find('" + $('#experience').val() + "', Experience), ";

    // if($('#no-tech').is(':checked') && !$('#tech').is(':checked'))
    //     query += "Find('unplugged', Tags), ";
    // else if(!$('#no-tech').is(':checked') && $('#tech').is(':checked'))
    //     query += "NOT(Find('unplugged', Tags)), ";
    query += _getMaterialsQuery();

    if($('input[type="search"]').val() != '')
        query += "Find('" + $('input[type="search"]').val().toLowerCase() + "', {Search Text}), ";

    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + ")";
    console.log('query string: ' + query);
    if(query == "AND)")
        alert('Please use at least one search option to find resources.');
    return query;
}

/*
    Helper function for _getQueryString
    Compile all the materials checkboxes into part of the Airtable query
    @private
*/
function _getMaterialsQuery() {
    var query = "OR(";

    if($('#browser').is(':checked'))
        query += "Find('Device w/ Browser', Materials), ";
    if($('#pen-paper').is(':checked'))
        query += "Find('Pen and Paper', Materials), ";
    if($('#craft').is(':checked'))
        query += "Find('Craft Supplies', Materials), ";
    if($('#art').is(':checked'))
        query += "Find('Art Supplies', Materials), ";
    if($('#robotics').is(':checked'))
        query += "Find('Robotics', Materials), ";

    if(query == "OR(")
        return "";

    string_preslice = query;
    var split_index = query.lastIndexOf(',');
    query = query.slice(0, split_index) + "), ";
    return query;
}

/*
    Generate HTML for all resources returned by a search query. 
    Called by renderTable()
    @param {array} search_resutls - resources returned by a query search to airtable
    @private
*/
function _buildTable(search_results) {
    console.log('building ' + search_results.length + ' resources');
    var new_elements;
    var grid_item = "<span class='item'>*</span>";
    search_results.forEach(function(resource, index) {
        console.log('appending ' + resource["Resource Name"]);
        new_elements = grid_item.replace('*', '<a target="_blank" href="'+ resource["Resource Link"] +'">'+ resource["Resource Name"] +'</a>');
        // if(item['Tags'].includes('incomplete')) 
        //     resource_link = _adaptActivity(resource_link, i, item["Resource Name"]);
        // new_elements += grid_item.replace('*', resource["Description"]);
        author_link = 'Created by <a target="_blank" href="' + resource["Source Link"] + '">' + resource["Source"] + '</a>'
        new_elements += grid_item.replace('*', author_link);
        new_elements += grid_item.replace('*', resource["Duration"]);
        new_elements += grid_item.replace('*', resource["Experience"]);
        new_elements += grid_item.replace('*', resource["Subject"]);
        new_elements += grid_item.replace('*', _starsMarkup(resource));
        new_elements += grid_item.replace('*',  "<center><big><a href='#' data-featherlight='#resource" + index + "'>&#9432;</a></big></center>");
        $('.grid-container').append(new_elements); 
        _addLightbox(resource, index);
    });  
    $('.star').click(function() {
        var name = $(this).parent().attr('id');
        var rating = $(this).attr('id').split('star')[1];
        confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?");
    });
}

/*
    Add rating column for an activity. As of 1/12/20 this feature is being
    rendered as responsive stars to click for a rating and a number/10 
    existing rating.
    @param {object} resrouce - Airtable resource object
    @private
*/
function _starsMarkup(resource) {
    var markup = $('#stars-template').html().replace('stars-id', resource["Resource Name"]);
    if(resource.Rating == undefined)
        markup = markup.replace('rating/5 by num','');
    else {
        markup = markup.replace('rating', resource.Rating);
        markup = markup.replace('num', resource.Votes + (resource.Votes == 1 ? ' vote' : ' votes'));
    }

    return markup;
}

/*
    Create a lightbox to house the "More Info" text for an activity
    This includes a thumbnail if the activity has one, link to the activity,
    activity description, and activity tags.
    @param {object} resource - resource object as returned from Airtable
    @param {int} index - number of the activity in the search results. 
        also the html id number for this element
    @private

    TODO: create lightbox with generic thumbnail image if no thumbnail exists. 
        continue to evaluate what content fits best here
*/
function _addLightbox(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            <a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>
            <br />
            <span>*description</span><br />
            <span>*materials</span><br />
            <span>*tags</span>
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    // console.log('building img with ' + resource.Thumbnail[0].url);
    if(resource.Thumbnail != undefined) 
        html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
    html_template = html_template.replace('*title', resource["Resource Name"]);
    html_template = html_template.replace('*description', resource["Description"]);
    if(resource.Materials != "None")
        html_template = html_template.replace('*materials',  "This activity requires the following materials: " + resource["Materials"]);
    html_template = html_template.replace('*tags', "Keyword tags: " + resource.Tags);
    $('.grid-container').append(html_template);
}

/*
    Create a ligthbox similar to the 
*/
function _addLightboxAUTHOR(resource, index) {
    var html_template = `<div class='ligthbox-grid' id='*id' hidden>
            <a target='_blank' href='*link'>*img<span align='center'><h3>*title</h3><span></a>
            *info
        </div>`;
    var author_info = "<a target='_blank' href='" + resource["Source Link"] + "'>" + resource.Source + "</a>";

    html_template = html_template.replace('*id', 'resource' + index);
    // console.log('building img with ' + resource.Thumbnail[0].url);
    if(resource.Thumbnail != undefined) 
        html_template = html_template.replace('*img',"<img class='lightbox' src='" + resource.Thumbnail[0].url + "'>");
    html_template = html_template.replace('*title', resource["Resource Name"]);
    html_template = html_template.replace('*info', "This resource was created by " + author_info + " and has the following keyword tags: " + resource.Tags);
    $('.grid-container').append(html_template);
}

/*
    post a new rating to the database;
*/
function _postRating(name, rating) {
    return;
}

/*
    Clear the table from previous search results
*/
function _clearTable() {
    $('.item').remove();
    $('.lightbox').remove();
}

/*
    Start a new search if the user presses "Enter" after typing in the search box.
    With the new (non-datatables) implementation this could also be handled by
    making the search bar part of a form with a Submit button
*/
function _handleSearch() {
    $('input[type="search"]').on('keydown', function(e) {
        if (e.which == 13) {
            renderTable(true);
        }
    });
}


//////////      DEPRECATED          /////////////
/*
    The following functions were used with the CS Resource table but are not a part 
    of the current build. They may involve the datatables plugin and/ or the Google Sheets API
*/


function renderTableDEPRECATED(search=false) {
    // var render_data = _filterResources(resource_table[table_state]);
    var table_source = [];
    var search_string = _getSearchString();//$('input[type="search"]').val();
    // var resource_link;
    
    if(render_data.length == 0) {
        alert('This Search returned no activities.');
        return;   
    }
    
    renderFeatures(render_data);

    $.map(render_data, function(item, index) {
        var subjects = Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"];
        // var author_link = '<a target="_blank" href="' + item["Author Link"] + '">' + item["Author"] + '</a>';
        var activity_link = '<a target="_blank" href="' + item["Resource Link"] + '"">' + item["Resource Name"] + '</a>';

        var lightbox = _moreInfo(item, index);

        if(item['Tags'].includes('incomplete')) {
            resource_link = _adaptActivity(activity_link, index, item["Resource Name"]);
        } else
            resource_link = activity_link;

        table_source.push([resource_link, item["Description"], item["Duration"], item["Grade Level"], subjects, item["Tech Required"], lightbox]);       
    });

    if(table_ref)
        _refreshTable(table_source, search_string);
    if(search) {
        $('#resource-table_wrapper').show();
        document.querySelector('#content').scrollIntoView({ 
          behavior: 'smooth' 
        });
        location.hash = search_string;
    }
    return table_source;
}

/*
    Get the "Resource Table" Google sheet from https://docs.google.com/spreadsheets/d/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/
    Once the HTTP Request is complete, call helper functions to populate the array and build
    page features. This function makes use of the Google Sheets API
    Reference: https://developers.google.com/sheets/api/
    @private
*/
function _buildTableDEPRECATED() {
    // _displayLoading(true);
    _addGradeRange();
    _renderSelects();
    // var table = _setupDataTable(renderTable());
    _setupDataTable(renderTable());
    // renderFeatures();
    return;
    
    $.ajax({
        url: "https://content-sheets.googleapis.com/v4/spreadsheets/1EdmNxW0F5jTdkemGx95QB_WbasvWVGEfVXuCAZ19cXU/values/A2%3AM",
        type: "get",
        data: {
          majorDimension: 'ROWS',
          // ranges: 'A7:M10',
          key: API_KEY
        },
        success: function(response) {
            var new_activities = _storeData(response);
            // _displayLoading(false);
            _addGradeRange(new_activities);
            _updateSelects();
            renderTable();
        },
        error: function(error) {
            _displayError(error);
        },
        timeout: 10000
    });
}


/*
    Create a search string from the chosen filter options. 
*/
function _getSearchString() {
    var search_params = [];

    // if($('input[type="search"]').val() != "")
    //     search_params.push($('input[type="search"]').val());
    
    if($('#subject').val() != "") 
        search_params.push("Subject=" + $('#subject').val());

    if($('#grade').val() != "")
        search_params.push("Grade=" + $('#grade').val());

    if($('#no-tech').is(':checked'))
        search_params.push('unplugged');

    if($('#tech').is(':checked'))
        search_params.push('tech');

    return "q=" + search_params.join('&');
}

/*
    Display some text or graphic to show that the resources are still loading
*/
function _displayLoading(loading) {
    if(loading)
        $('#load-div').show();
    else
        $('#load-div').hide();
}

/*
    Store Google Sheet data in the resource_table variable
    This involves parsing every row from the table (stored as arrays)
    into individual JSON objects
    @param {object} response- REST response 
    @private
*/
function _storeData(response) {
    var new_activities = [];
    console.log("processing " + response.values.length + " activities from Google Sheets");
    for(let i=0; i<response.values.length; i++) {
        var value = response.values[i];
        if(!value[11])
            value[11] = "";
        
        // resource_table.Activities.push({
        var new_activity = {
          "Resource Name": value[0],
          "Resource Link": value[1],
          "Duration": value[2],
          "Grade Level": value[3],
          "Subject": value[4].split(", "),
          "Tech Required": value[5].split(", "),
          "Author": value[6],
          "Author Link": value[7],
          "Tags": value[8].split(", "),
          "Additional Info": value[9],
          "Description": value[10],
          "Img URL": value[11]
        };

        if(!resource_table.Activities.find(act => act["Resource Name"] === new_activity["Resource Name"])) {
            console.log("pushing " + new_activity["Resource Name"]);
            resource_table.Activities.push(new_activity);
            new_activities.push(new_activity);
        }
    }
    return new_activities;
}

/*
    Wrap our table with the DataTables plugin from https://www.datatables.net/
    This makes the columns sortable and options for filtering by a search bar
    and displaying n entries per page.
*/
function _setupDataTable(table_source) {
    // custom grade sort could use some improvement, e.g. so 3-9 is higher than K-5
    jQuery.fn.dataTableExt.oSort["grade-desc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return y-x;
    };

    jQuery.fn.dataTableExt.oSort["grade-asc"] = function (x, y) {
        x = x.match(/\d+/);
        y = y.match(/\d+/);
        return x-y;
    };

    table_ref = $('#resource-table').DataTable({
        data: table_source,
        // columns: columns
      "pageLength": 50,
      "columnDefs": [
            { "orderable": false, "targets": [1, 4, 5, 6] },
            { "type": "grade", "targets": 3 }
            // { "dom": '<"wrapper"fli>' }
        ]
    });
    // datatable = table_ref;
    // return table_ref;
}
/*
    Create DOM elements for the features to live in
    @private
*/
function _setupFeatureElemnts() {
    $('#load-div').after(`
    <span id="content"> </span>
    <section id="feature-container">
      <br /><h3>Featured Activities:</h3><br />
      <div class="features">
        <div class="featured-activity" id="featurediv1"></div>
        <div class="featured-activity" id="featurediv2"></div>
        <div class="featured-activity" id="featurediv3"></div>
      </div>
    </section>
    <br />`);
}



/*
    Render 3 Featured Activities at the top of the page. 
    Check which of the search results have thumbnails, then render
    3 of those. 
    @param {array} search_results - list of activites returned based on a user search

    TODO: select activities by highest ratings
*/
function renderFeatures(search_results) {
    console.log('rendering features');
    var feature_list = [];
    search_results.forEach(function(resource) {
        if(resource.Thumbnail != undefined && feature_list.length < 3)
            feature_list.push(resource);
    });
    console.log('building ' + feature_list.length + ' features');
    _buildFeatures(feature_list);
}
