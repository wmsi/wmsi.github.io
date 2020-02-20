// When the page loads populate the table with activities and render the dropdown menus.
// Add a graderange to each activity that JS can interpret
$(document).ready(function(){
    $('.grid-container').hide();
    $('.lds-ring').hide();

    _renderSelects();
    _setupFeatures();
    _handleSearch();
    setupDevMenu();

    $('#search').click(function() {renderPages()});//renderTable()});
    $('#reset').click(function() {resetFilters()});
    $('#self-led-button').click(function() {renderSelfLed()});
    $('#uncheck-materials').click(function() {
        $('#materials-filter').children().prop('checked', false);
    });
    _bindScrollClicks();
});

/*
    Handle events related to dev features menu in bottom left of page
*/
function setupDevMenu() {
    $('#top-carousel-toggle').click(function() {
        if($('#top-carousel-toggle').is(':checked'))
            $('.top-features').show();
        else 
            $('.top-features').hide();
    });
    $('#pages-toggle').click(function() {
        if($('#pages-toggle').is(':checked')) {
            $('.page-controls').show();
            $('#results-meta').show();
            $('#search').unbind('click').click(function() {renderPages()});
        } else { 
            $('.page-controls').hide();
            $('#results-meta').hide();
            $('#search').unbind('click').click(function() {renderTable()});
        }
    });
    $('#sort-toggle').click(function() {
        if($(this).is(':checked'))
            $('#sort-results').show();
        else 
            $('#sort-results').hide();
    });
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
        var activity_link = grid_item.replace('*', '<a target="_blank" href="'+ resource["Resource Link"] +'">'+ resource["Resource Name"] +'</a>');
        if(resource['Tags'].includes('incomplete')) 
            activity_link = _adaptActivity(resource, index);
            // activity_link = _adaptActivity(activity_link.replace(" class='item'",""), index, resource["Resource Name"]);
        // else
        //     console.log('building activity with link ' + activity_link);
        
        new_elements = activity_link;
        author_link = '<a target="_blank" href="' + resource["Source Link"] + '">' + resource["Source"] + '</a>'
        new_elements += grid_item.replace('*', author_link);
        new_elements += grid_item.replace('*', resource["Duration"]);
        new_elements += grid_item.replace('*', resource["Experience"]);
        new_elements += grid_item.replace('*', resource["Subject"]);
        // new_elements += grid_item.replace('*', _starsMarkup(resource));
        new_elements += grid_item.replace('*',  "<center><big><a href='#' data-featherlight='#resource" + index + "'>&#9432;</a></big></center>");
        // new_elements += grid_item.replace('*', _commentSection(resource, index));//      
        $('#content').append(new_elements); 
        _addLightbox(resource, index);
        _commentSection(resource, index);
    }); 
    _postRatings(search_results);
}

function _commentSection(resource, index) {
    var element = "<span class='item'>" + $('#comments-img').html() + "</span>";
    // make sure each tooltip positions on top of other elements
    element = element.replace('*pos', 200-index);
    element = element.replace(/@index/g, index);
    $('#content').append(element);

    // resource.Comments.forEach(comment =>  {
    if(resource.Comments != undefined) {
        console.log('parsing comments for ' + resource["Resource Name"] + ': ' + resource.Comments);
        var comments = JSON.parse('['+resource.Comments+']');
        comments.forEach(comment =>  {
            console.log(comment);
            $('#comments-text'+index).append(comment[0] + ': ' + comment[1] + '<br>');
        });
    }

    var id = '#post-comm' + index;
    var text_id = '#new-comment' + index; //.featherlight-inner 
    var form_id = '.featherlight-inner #comment-form'+index;
    $(form_id).hide();
    // $('#new-comment'+index).click(function() {$(form_id).show()});//console.log('$("' + form_id + '").show()')});
    $(text_id).unbind('focus').focus(function() {
        $(this).css('height','90px');
        $(form_id).show()}
    );
    // $(text_id).unbind('focusout').focusout(function() {$(form_id).hide()});

    $(id).unbind('click').click(function() {
        var comment = $('.featherlight-inner #new-comment' + index).val();
        var user = $('.featherlight-inner #comment-name' + index).val();
        user = (user == "" ? "Anonymous" : user);
        if(comment != '') {
            console.log('posting comment: '+ comment +' to airtable from user ' + user);
            $.ajax({
                    type: 'POST',
                    url: 'https://wmsinh.org/airtable',
                    // url: 'http://localhost:5000/airtable',
                    data: {
                        "id": resource.id,
                        "Comment": '["' + user + '", "' + comment + '"]'//comment
                    }
                });
            $('.featherlight-inner #comments-text'+index).append(user + ': ' + comment + '<br>');
        }
    });
}

/*
    Manage locally stored search results. Update sorting, meta data, and buttons
    as necessary.
    @param {array} search_results - all results returned by the current search
    @param {int} page_size - number of results per page
    @param {int} page - number of the current page
    @param {boolean} sort - variable to keep sort from always calling this function recursively
    @private
*/
function _manageTableLocal(search_results, page_size, page=0, sort=true) {
    var start = page*page_size;
    var end = Math.min((page+1)*page_size, search_results.length);
    this_page = search_results.slice(start, end); // change this to default first page
    console.log('rendering search results from index ' + start + ' to ' + end);
    _clearTable();
    _buildTable(this_page);
    _displayMetaData(this_page, page_size, page, search_results.length);
    _createLocalButtons(search_results, page_size, page);
    _sortResults(search_results, false);
    _sortResultsDropdown(search_results, false);
    $('#sort-results').change(() => {_manageTableLocal(search_results, page_size, page)});
    $('i').click(() => {_manageTableLocal(search_results, page_size, page)});
    $('#results-per-page').unbind('change').change(function() {changePageLengthLocal(start, search_results)});  
}

/*
    Render STEM Resource table based on search parameters
    Generate a query and send it to the API proxy on our Linode
    (wmsinh.org), then handle the response
    DOES NOT use pages, ie renders all results at once
*/
function renderTable() {
    _displayLoading(true);
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('filter by formula: ' + query_string);
    $('.grid-container').show();
    search_results = [];
    // var url = "https://wmsinh.org/airtable?query=" + query_string;
    var url = "https://wmsinh.org/airtable";
    // var url = "http://localhost:5000/airtable";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url,
        data: {
            query: query_string
        }
    }).done(function(data, status) {
        search_results=JSON.parse(data);
        _renderFeatures(search_results);
        _buildTable(search_results);
        _displayLoading(false);
        _displayMetaData(search_results, search_results.length);
        _sortResults(search_results);
        _sortResultsDropdown(search_results);
        document.querySelector('#results').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/*
    Add a 'self-led activities' filter on top of any other search filters
    TODO: find a cleaner way to implement this
*/
function renderSelfLed() {
    $('#self-led').prop('checked', true);
    // renderTable();
    renderPages();
    $('#self-led').prop('checked', false);
}

/*
    Sort search results based on selected dropdown option
    @param {array} search_results - Airtable activities based on search options
    @param {boolean} build - call _buildTable() from here? Unnecessary when called
        by _manageTableLocal()
    @private
*/
function _sortResultsDropdown(search_results, build=true) {
    $('#sort-results').unbind('change').change(function(event) {
        event.stopPropagation();
        console.log('sort results triggered');
        var sort = $(this).val();
        if(sort == "")
            _sortText(search_results, "Resource Name", true);
        if(sort == "experience-low") 
            _sortExperience(search_results, true);
        if(sort == "experience-high") 
            _sortExperience(search_results, false);
        if(sort == "time-short") 
            _sortTime(search_results, true);
        if(sort == "time-long") 
            _sortTime(search_results, false);
        if(sort == "rating")
            _sortRating(search_results);

        if(build) {
            _clearTable();
            _buildTable(search_results);
        }
    });

    // if a sort mode is selected apply it to the new search
    if($('#sort-results').val() != '')
        $('#sort-results').change();
}

/*
    Add features to the top of the page. 
    Features are chosen using the _buildFeatureList function
    @private
*/
function _setupFeatures() {
    var search_results = [];
    var url = "https://wmsinh.org/airtable?query=AND(NOT({Thumbnail} = ''), NOT(Find('inomplete', Tags)))";
    $('.lds-large').show();
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url
    }).done(function(data, status) {
        search_results=JSON.parse(data);
        feature_list = _buildFeatureList(search_results);
        _buildFeatureCarousel(feature_list, '#feature-header');
        $('.lds-large').hide();
    });
}

/*
    Re-build features carousel at top of the page.
    Features are chosen using the _buildFeatureList function
    @private
*/
function _renderFeatures(search_results) {
    $('#feature-results').empty();

    var feature_list = _buildFeatureList(search_results);
    console.log('rendering ' + feature_list.length + ' new features');
    if(feature_list.length == 0)
        $('#results').hide();
    else {
        _buildFeatureCarousel(feature_list, '#feature-results');
        $('#results').show();
    }

    //TODO: do this differently or remove, depending on final carousel location
    if($('.welcome').length) {
        $('.welcome').remove();
        $('#feature-header').parent().remove();
        _bindScrollClicks();
    }
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
function _buildFeatureCarousel(features, location) {
    features.map(function(item, i) {
        var feature_id = 'feature' + i;
        var subjects = Array.isArray(item["Subject"]) ? item["Subject"].join(", ") : item["Subject"];
        var resource_link = '<a target="_blank" href="'+ item["Resource Link"] +'">'+ item["Resource Name"] +'</a>';
        var feature_div = `
        <a href="#" data-featherlight="#`+ feature_id +`"><img src="` + item.Thumbnail[0].url + `" />
            <span class="feature-link">`+ item["Resource Name"] +`</span></a>
                <div style="display: none"><div id="`+ feature_id +`" style="padding: 10px;">
                    <h3>` + resource_link + `</h3>
                    <br />`+ item["Description"] +`<br /><br />
                    <b>Experience Level: </b>`+ item["Experience"] +`<br />
                    <b>Subject: </b>`+ subjects +`<br />
                    <b>Materials: </b>`+ features[i]["Materials"] +`<br />
                    <b>Author: </b><a href="`+ features[i]["Source Link"] +`">`+ features[i]["Source"] +`</a><br>   
                </div>`; // <b>Rating: </b>` + _starsMarkup(features[i]) + `
        $(location).append("<li>" + feature_div + "</li>");
        // $("#featured-activities").append("<div class='thumbnail' list-index='" + features.indexOf(item) + "'>" + feature_div + "</div>");
    });
    $(location).css('grid-template-columns', 'repeat(' + features.length + ', 240px)');
    _postRatings(features);
}

/*
    Trigger a scroll of the features carousel when user clicks on an arrow
    This gets called whenever a new carousel is rendered (e.g. after a search)
    @private
*/
function _bindScrollClicks() {
    $('#scroll-right').click(function() {
        $('.feature-list').animate( {scrollLeft: '+=780' }, 500);
    });
    $('#scroll-left').click(function() {
        $('.feature-list').animate( {scrollLeft: '-=780' }, 500);
    });
}













////////////////////      DEPRECATED          ///////////////////////
/*
    Obtain search results one page at a time instead of all at once to preserve
    connection speed. Eventually this may replace renderTable() as the default
    "render" function. 
    @param {int} page_size - number of results to render per page
    @param {int} page - page number 
    TODO: how do we implement sort with the page by page approach?
*/
function renderPage(page_size=50, page=0) {
    _displayLoading(true);
    _clearTable();
    var query_string = _getQueryString();
    if(query_string == 'AND)')
        return;
    console.log('getting page: ' + page);
    $('.grid-container').show();
    var search_results = [];
    // var url = "https://wmsinh.org/airtable?query=" + query_string;
    // var url = "https://wmsinh.org/airtable";
    var url = "http://localhost:5000/airtable";
    $.ajax({
        type: 'GET',
        headers: {'Access-Control-Allow-Origin': '*'},
        url: url,
        data: {
            query: query_string,
            page_size: page_size,
            page_num: page,
            sort: _getSortTuple()
        }
    }).done(function(data, status, jqXHR) {
        search_results=data;//JSON.parse(data);
        var num_results = parseInt(jqXHR.getResponseHeader('num_results'));
        _renderFeatures(search_results);
        _buildTable(search_results);
        _displayLoading(false);
        // test = jqXHR;
        _displayMetaData(search_results, page_size, page, num_results);
        $('#results-per-page').unbind('change').change(function() {changePageLength(page_size*page)});
        _createButtonFunctions(page, (page+1)*page_size, num_results);
        _sortResults(search_results);
        _sortResultsDropdown(search_results);
        document.querySelector('#results').scrollIntoView({ 
          behavior: 'smooth' 
        });
    });
}

/*
    Attach behavior to Next Page and Last Page buttons
    Unbind any functions previously attached to those buttons
    Change styling to reflect (in)active buttons
    @param {int} page - current page number
    @param {int} last - index of the last record on the current page
    @param {int} num_results - total number of results returned by the current search
    @private
*/
function _createButtonFunctions(page, last, num_results) {
    console.log('creating button functions with page ' + page + ', end ' + last + ', num_results ' + num_results);
    var next_page = last < num_results ? true : false;
    var last_page = page > 0 ? true : false;
    if(next_page) {
        $('#next-page').unbind('click').click(function() {
            renderPage(parseInt($('#results-per-page').val()), page+1);
        });
    } 
    if(last_page) {
        $('#last-page').unbind('click').click(function() {
            renderPage(parseInt($('#results-per-page').val()), page-1);
        });
    } 
    _buttonCss(next_page, last_page);
}

/*
    Make a sort tuple to incorporate into Airtable query
    @private
    TODO: our sort doesnt map well to Airtable's (e.g. experience, duration strings)
        Find a way to massage field values to sort alphabetically
        **OR cache all results and paginate locally
*/
function _getSortTuple() {
    var sort = $('#sort-results').val();
    if(sort == "experience-low") 
        return ['Experience', 'asc'];
    if(sort == "experience-high") 
        return ['Experience', 'desc'];
    if(sort == "time-short") 
        return ['Duration', 'asc'];
    if(sort == "time-long") 
        return ['Duration', 'asc'];
    if(sort == "rating")
        return ['Rating', 'asc'];
    else
        return '';
}

/*
    The following functions were used with the CS Resource table but are not a part 
    of the current build. They may involve the datatables plugin and/ or the Google Sheets API
*/

/*
    Trigger an event when stars are clicked and
    post a new rating to Airtable
    @private
*/
// function _postRatings() {
//     $('.star').click(function() {
//         var name = $(this).parent().attr('id');
//         var rating = $(this).attr('id').split('star')[1];
//         if(confirm("Do you want to post a rating of " +rating+"/5 to "+name+"?")) {
//             console.log('posting ' + rating + ' to airtable for activity ' + name);
//         }
//     });
// }


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
    Reveal a the More Info lightbox for a resource
    @param {int} index - index of the resource in the table
*/
function showLightbox(index) {
    var id = '#resource' + index;
    $(id).show();
}

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